FROM python:3.12-slim

WORKDIR /app

COPY services/voice-local-tts/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY services/voice-local-tts/src ./src

ENV VOICE_LOCAL_TTS_PORT=8082

CMD ["python", "src/service.py"]
