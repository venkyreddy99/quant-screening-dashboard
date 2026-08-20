"""Explainable SMMA crossover engine for the NSE screening assignment.

The engine is deliberately broker-agnostic. Feed it normalized ticks from
Fyers, Angel One, or a replay file and it will maintain rolling windows,
screen liquidity, detect every SMMA crossover, and score the signal using
LTQ and market-depth features.
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta, timezone
from statistics import fmean
from typing import Deque, Iterable, Literal


Signal = Literal["BUY", "SELL", "NEUTRAL"]
Decision = Literal["ACCEPT", "AVOID", "WATCH"]


@dataclass
class Tick:
    symbol: str
    timestamp: datetime
    ltp: float
    ltq: int
    bid_price: float
    bid_qty: int
    ask_price: float
    ask_qty: int


@dataclass
class SignalEvent:
    symbol: str
    timestamp: datetime
    signal: Signal
    ltp: float
    smma20: float
    smma120: float
    confidence: float
    decision: Decision
    rationale: list[str] = field(default_factory=list)
    features: dict[str, float] = field(default_factory=dict)


def smma(values: Iterable[float], period: int) -> float | None:
    """Return the latest smoothed moving average using Wilder's recurrence."""
    prices = list(values)
    if len(prices) < period:
        return None
    current = fmean(prices[:period])
    for price in prices[period:]:
        current = ((current * (period - 1)) + price) / period
    return current


class SymbolAnalyzer:
    """Stateful per-symbol analyzer that accepts normalized broker ticks."""

    def __init__(self, symbol: str, history_limit: int = 240) -> None:
        self.symbol = symbol
        self.ticks: Deque[Tick] = deque(maxlen=history_limit)
        self.events: list[SignalEvent] = []
        self._previous_spread: float | None = None

    def add_tick(self, tick: Tick) -> SignalEvent | None:
        if tick.symbol != self.symbol:
            raise ValueError(f"Expected {self.symbol}, received {tick.symbol}")
        self.ticks.append(tick)
        if len(self.ticks) < 120:
            return None

        prices = [item.ltp for item in self.ticks]
        short = smma(prices, 20)
        long = smma(prices, 120)
        previous_prices = prices[:-1]
        previous_short = smma(previous_prices, 20)
        previous_long = smma(previous_prices, 120)
        if None in (short, long, previous_short, previous_long):
            return None

        crossed_up = previous_short <= previous_long and short > long
        crossed_down = previous_short >= previous_long and short < long
        if not crossed_up and not crossed_down:
            return None

        signal: Signal = "BUY" if crossed_up else "SELL"
        feature_set = self.features()
        confidence, decision, rationale = score_signal(signal, feature_set)
        event = SignalEvent(
            symbol=self.symbol,
            timestamp=tick.timestamp,
            signal=signal,
            ltp=tick.ltp,
            smma20=short,
            smma120=long,
            confidence=confidence,
            decision=decision,
            rationale=rationale,
            features=feature_set,
        )
        self.events.append(event)
        return event

    def features(self) -> dict[str, float]:
        if not self.ticks:
            return {}
        latest = self.ticks[-1]
        now = latest.timestamp

        def recent(minutes: int) -> list[Tick]:
            cutoff = now - timedelta(minutes=minutes)
            return [tick for tick in self.ticks if tick.timestamp >= cutoff]

        last_2 = recent(2)
        last_5 = recent(5)
        last_20 = recent(20)
        last_60 = recent(60)
        avg_ltq_2 = fmean([tick.ltq for tick in last_2]) if last_2 else 0.0
        avg_ltq_5 = fmean([tick.ltq for tick in last_5]) if last_5 else 0.0
        smma20_value = smma([tick.ltp for tick in self.ticks], 20) or latest.ltp
        smma120_value = smma([tick.ltp for tick in self.ticks], 120) or latest.ltp
        spread = max(latest.ask_price - latest.bid_price, 0.0)
        self._previous_spread = spread
        return {
            "ltq_burst_ratio": avg_ltq_2 / avg_ltq_5 if avg_ltq_5 else 0.0,
            "order_imbalance": (latest.bid_qty - latest.ask_qty)
            / max(latest.bid_qty + latest.ask_qty, 1),
            "spread_bps": spread / latest.ltp * 10_000 if latest.ltp else 0.0,
            "trend_pct": (smma20_value - smma120_value)
            / smma120_value
            * 100
            if smma120_value
            else 0.0,
            "etq_5m": sum(tick.ltq for tick in last_5),
            "etq_20m": sum(tick.ltq for tick in last_20),
            "etq_60m": sum(tick.ltq for tick in last_60),
        }

    def snapshot(self) -> dict:
        if not self.ticks:
            return {"symbol": self.symbol}
        latest = self.ticks[-1]
        prices = [tick.ltp for tick in self.ticks]
        metrics = self.features()
        short = smma(prices, 20)
        long = smma(prices, 120)
        signal: Signal = "NEUTRAL"
        if short is not None and long is not None:
            signal = "BUY" if short > long else "SELL"
        return {
            **asdict(latest),
            "smma20": short,
            "smma120": long,
            "avg_ltp_20m": _average_price(self.ticks, latest.timestamp, 20),
            "avg_ltp_60m": _average_price(self.ticks, latest.timestamp, 60),
            "signal": signal,
            "events": [asdict(event) for event in self.events[-20:]],
            **metrics,
        }


def _average_price(ticks: Iterable[Tick], now: datetime, minutes: int) -> float:
    cutoff = now - timedelta(minutes=minutes)
    values = [tick.ltp for tick in ticks if tick.timestamp >= cutoff]
    return fmean(values) if values else 0.0


def score_signal(signal: Signal, features: dict[str, float]) -> tuple[float, Decision, list[str]]:
    """A transparent baseline model suitable for a first live deployment.

    The score is intentionally inspectable: it is a quantitative gate, not a
    claim of guaranteed returns. Replace this function with a fitted model
    after collecting labeled crossover outcomes.
    """
    if signal == "NEUTRAL":
        return 0.5, "WATCH", ["No crossover has been confirmed."]

    score = 0.50
    rationale: list[str] = []
    burst = features.get("ltq_burst_ratio", 0)
    imbalance = features.get("order_imbalance", 0)
    spread = features.get("spread_bps", 999)
    trend = features.get("trend_pct", 0)
    direction = 1 if signal == "BUY" else -1

    if burst >= 1.35:
        score += 0.18
        rationale.append("LTQ is accelerating versus its five-minute baseline.")
    else:
        score -= 0.10
        rationale.append("No decisive LTQ acceleration is visible yet.")
    if direction * imbalance >= 0.12:
        score += 0.16
        rationale.append("Market depth supports the signal direction.")
    else:
        score -= 0.12
        rationale.append("Bid/ask imbalance does not confirm the signal direction.")
    if direction * trend > 0.05:
        score += 0.10
        rationale.append("SMMA separation has directional follow-through.")
    if spread > 35:
        score -= 0.14
        rationale.append("Wide spread increases execution risk.")

    confidence = max(0.05, min(0.95, score))
    decision: Decision = "ACCEPT" if confidence >= 0.68 else "AVOID" if confidence < 0.48 else "WATCH"
    return confidence, decision, rationale


def screen(ticks: Iterable[Tick]) -> list[dict]:
    """Apply the assignment's ₹30–₹500 and >10 lakh depth filters."""
    return [
        item
        for item in (asdict(tick) for tick in ticks)
        if 30 <= item["ltp"] <= 500
        and item["bid_qty"] > 1_000_000
        and item["ask_qty"] > 1_000_000
    ]


if __name__ == "__main__":
    # Small smoke example for a broker-normalized feed.
    analyzer = SymbolAnalyzer("DEMO")
    start = datetime.now(timezone.utc) - timedelta(minutes=120)
    for index in range(121):
        price = 100 + (index * 0.04 if index > 70 else index * -0.015)
        analyzer.add_tick(
            Tick(
                symbol="DEMO",
                timestamp=start + timedelta(minutes=index),
                ltp=price,
                ltq=40_000 if index > 116 else 12_000,
                bid_price=price - 0.05,
                bid_qty=1_500_000,
                ask_price=price + 0.05,
                ask_qty=1_250_000,
            )
        )
    print(analyzer.snapshot())