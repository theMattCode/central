FROM python:3.12-slim

ARG VOICE_LOCAL_TTS_ENABLE_GPU=false

WORKDIR /app

COPY services/voice-local-tts/requirements.txt ./requirements.txt
RUN if [ "$VOICE_LOCAL_TTS_ENABLE_GPU" = "true" ]; then \
        pip install --no-cache-dir \
          "pathvalidate>=3.2.0,<4.0.0" \
          flatbuffers \
          numpy \
          packaging \
          protobuf \
          sympy \
          onnxruntime-gpu \
          nvidia-cublas-cu12 \
          nvidia-cudnn-cu12==9.* \
        && pip install --no-cache-dir --no-deps "piper-tts>=1.3.0,<2.0.0"; \
    else \
        pip install --no-cache-dir -r requirements.txt; \
    fi

COPY services/voice-local-tts/src ./src

ENV VOICE_LOCAL_TTS_PORT=8082
ENV LD_LIBRARY_PATH=/usr/local/lib/python3.12/site-packages/nvidia/cublas/lib:/usr/local/lib/python3.12/site-packages/nvidia/cudnn/lib

CMD ["python", "src/service.py"]
