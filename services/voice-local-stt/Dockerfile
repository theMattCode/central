FROM python:3.12-slim

WORKDIR /app

COPY services/voice-local-stt/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY services/voice-local-stt/src ./src

ENV VOICE_LOCAL_STT_PORT=8081

CMD ["python", "src/service.py"]
