FROM python:3.12-slim

WORKDIR /app

COPY services/voice-local-llm/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY services/voice-local-llm/src ./src

ENV VOICE_LOCAL_LLM_PORT=8083

CMD ["python", "src/service.py"]
