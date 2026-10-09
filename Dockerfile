FROM python:3.11-slim
WORKDIR /app
COPY app.py .
COPY bg.webp .
COPY index.html .
COPY english-mastery-standalone.html .
RUN pip install flask flask-sqlalchemy flask-bcrypt
EXPOSE 3007
CMD ["python","app.py"]
