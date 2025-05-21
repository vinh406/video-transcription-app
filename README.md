# Transcription and Summarization Web App
This project is a web application for audio and video transcription with built-in summarization capabilities. It features a Django backend for processing transcriptions and a React frontend for user interaction.

## Key Features

- **Multi-Service Transcription**: Support for multiple transcription services including WhisperX, Google Gemini, and ElevenLabs Scribe
- **YouTube Integration**: Transcribe content directly from YouTube URLs
- **AI Summarization**: Generate chapter-based summaries of transcribed content using Google Gemini
- **Interactive Media Player**: Synchronized transcript and media playback
- **Transcription History**: Track and manage previous transcriptions

## Screenshots
![image](https://github.com/user-attachments/assets/71be4c6e-1f64-439b-b2e7-f99d86e6df23)
![image](https://github.com/user-attachments/assets/518750e9-ecf7-4d8c-bdd8-dd10a73fb098)
![image](https://github.com/user-attachments/assets/6379705e-84ce-4e46-8a03-f18b243f6005)

## Project Structure

The project consists of two main parts:

### Backend (Django)
- core: Django project settings and main configuration 
- transcription: Main app for handling transcription functionality
- auth: User authentication and management
- evaluate: Transcription evaluation tools

### Frontend (React + TypeScript)
- transcription-frontend: React application built with TypeScript and Vite
- Modern UI using custom components and Tailwind CSS

## Technology Stack

### Backend
- Django 5.1
- Django Ninja for API
- PostgreSQL database
- Django Q2 for task queue management
- Google Gemini for AI summarization
- WhisperX for speech-to-text processing

### Frontend
- React 18 with TypeScript
- Tailwind CSS for styling
- Radix UI components
- Vite for development and building

## Installation

### Backend Setup
It is recommended to use [uv](https://docs.astral.sh/uv/getting-started/installation) as the virtual environment manager, as it simplifies the process of creating and managing virtual environments.
1. Clone the repository
2. Run the following command to create a virtual environment and install dependencies automatically:
   ```bash
   uv sync
   ```
3. Activate the virtual environment.
    For Windows:
    ```bash
    .venv\Scripts\activate
    ```
    For Linux/Mac:
    ```bash
    source .venv/bin/activate
    ```
4. Create a .env file in the project root with the following variables:

```
# PostgreSQL Database Configuration
DB_NAME=transcription_db
DB_USER=postgres
DB_PASSWORD=yourpassword
DB_HOST=localhost
DB_PORT=5432

# R2 Storage Configuration
R2_ACCOUNT_ID=your_r2_account_id
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET_NAME=your_r2_bucket_name
R2_REGION=your_r2_region

# API keys for transcription services
GOOGLE_API_KEY=your_google_api_key
ELEVENLABS_API_KEY=your_elevenlabs_api_key
HF_TOKEN=your_huggingface_token
```
5. Run the following command to apply migrations and create the database:
   ```bash
   python manage.py migrate
   ```
6. Create a superuser to access the admin panel:
   ```bash
    python manage.py createsuperuser
    ```
7. Start the Django development server and the task queue:
    ```bash
    python manage.py runserver
    ```
    ```bash
    python manage.py qcluster
    ```
### Frontend Setup
1. Navigate to the frontend directory: `cd transcription-frontend`
2. Install dependencies: `npm install`
3. Start the development server: `npm run dev`

## Usage

1. Register an account or login
2. Upload audio/video files or provide a YouTube URL
3. Select the transcription service and language
4. View the transcript along with the media player
5. Generate summaries to extract key points and chapters
6. Access your history to view previous transcriptions
