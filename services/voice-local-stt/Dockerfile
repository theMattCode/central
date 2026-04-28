FROM python:3.12-slim

ARG VOICE_LOCAL_STT_ENABLE_GPU=false

WORKDIR /app

COPY services/voice-local-stt/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt \
    && if [ "$VOICE_LOCAL_STT_ENABLE_GPU" = "true" ]; then \
        pip install --no-cache-dir nvidia-cublas-cu12 nvidia-cudnn-cu12==9.*; \
    fi

COPY services/voice-local-stt/src ./src

ENV VOICE_LOCAL_STT_PORT=8081
ENV LD_LIBRARY_PATH=/usr/local/lib/python3.12/site-packages/nvidia/cublas/lib:/usr/local/lib/python3.12/site-packages/nvidia/cudnn/lib

CMD ["python", "src/service.py"]
