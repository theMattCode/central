FROM python:3.12-slim

WORKDIR /app

COPY services/llm/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY services/llm/src ./src

ENV LLM_PORT=8083

CMD ["python", "src/service.py"]
