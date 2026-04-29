FROM python:3.12-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg libsndfile1 sox libsox-fmt-mp3 \
    && rm -rf /var/lib/apt/lists/*

COPY services/tts/requirements.txt ./requirements.txt
ARG PYTORCH_CUDA_INDEX_URL=https://download.pytorch.org/whl/cu128
ARG TORCH_VERSION=2.8.0
ARG TORCHAUDIO_VERSION=2.8.0
ARG FLASH_ATTENTION_WHEEL_URL=https://github.com/Dao-AILab/flash-attention/releases/download/v2.8.3/flash_attn-2.8.3%2Bcu12torch2.8cxx11abiTRUE-cp312-cp312-linux_x86_64.whl
RUN pip install --no-cache-dir --index-url "${PYTORCH_CUDA_INDEX_URL}" \
        "torch==${TORCH_VERSION}" \
        "torchaudio==${TORCHAUDIO_VERSION}" \
    && pip install --no-cache-dir "${FLASH_ATTENTION_WHEEL_URL}" \
    && pip install --no-cache-dir -r requirements.txt \
    && python -c "import flash_attn, torch; print(f'flash_attn ready with torch {torch.__version__}')"

COPY services/tts/src ./src
COPY services/tts/res ./res

ENV TTS_PORT=8082
ENV TTS_MODEL=Qwen/Qwen3-TTS-12Hz-1.7B-Base
ENV TTS_REFERENCE_AUDIO=/app/res/morgan-freeman.mp3
ENV TTS_REFERENCE_TEXT_FILE=/app/res/morgan-freeman.txt
ENV TTS_X_VECTOR_ONLY_MODE=false
ENV TTS_DEVICE_MAP=cuda:0
ENV TTS_DTYPE=bfloat16
ENV TTS_ATTENTION_IMPLEMENTATION=flash_attention_2
ENV HF_HOME=/models/huggingface

CMD ["python", "src/service.py"]
