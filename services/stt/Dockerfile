FROM python:3.12-slim

ARG STT_ENABLE_GPU=false

WORKDIR /app

COPY services/stt/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt \
    && if [ "$STT_ENABLE_GPU" = "true" ]; then \
        pip install --no-cache-dir nvidia-cublas-cu12 nvidia-cudnn-cu12==9.*; \
    fi

COPY services/stt/src ./src

ENV STT_PORT=8081
ENV LD_LIBRARY_PATH=/usr/local/lib/python3.12/site-packages/nvidia/cublas/lib:/usr/local/lib/python3.12/site-packages/nvidia/cudnn/lib

CMD ["python", "src/service.py"]
