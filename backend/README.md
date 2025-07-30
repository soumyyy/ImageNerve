# FastAPI Backend

## Setup

1. (Recommended) Create a virtual environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## Run the server

```bash
uvicorn main:app --reload
```

- The server will start at http://127.0.0.1:8000
- Test with: http://127.0.0.1:8000/ping 