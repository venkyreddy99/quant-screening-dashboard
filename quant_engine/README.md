# Quant Screening Engine

This folder contains the broker-agnostic Python implementation for the
technical assessment. It is intentionally safe to run without credentials.

## Run the demo

```bash
uv run python quant_engine/stock_engine.py
```

## Connect live data

Normalize each Fyers or Angel One tick into `Tick` and call
`SymbolAnalyzer.add_tick(tick)`. Keep credentials in environment secrets and
never commit them. The `screen()` helper enforces the assignment's LTP and
market-depth thresholds.

The scoring function is a transparent baseline while a labeled crossover
history is collected. Once outcomes are available, it can be replaced with a
fitted classifier using the same feature contract.

## Build a Windows executable

On a Windows machine with Python installed:

```powershell
py -m pip install pyinstaller
pyinstaller --onefile quant_engine/stock_engine.py
```