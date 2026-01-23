FROM python:3.12-slim

WORKDIR /app

COPY . .

RUN mkdir -p /app/data/projects

EXPOSE 8000

ENV DOCKER=1

CMD ["python", "serve.py"]
