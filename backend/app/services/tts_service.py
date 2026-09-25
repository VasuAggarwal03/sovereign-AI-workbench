import os
import subprocess
import tempfile


def generate_speech(text: str) -> bytes:
    """
    Generate speech locally using macOS built-in speech synthesis.
    Returns browser-friendly WAV audio.
    """

    if not text or not text.strip():
        raise ValueError("Text cannot be empty.")

    temp_file = tempfile.NamedTemporaryFile(
        suffix=".wav",
        delete=False,
    )

    output_path = temp_file.name
    temp_file.close()

    try:
        subprocess.run(
            [
                "say",
                "-o",
                output_path,
                text,
            ],
            check=True,
            capture_output=True,
            text=True,
        )

        with open(output_path, "rb") as audio_file:
            return audio_file.read()

    finally:
        if os.path.exists(output_path):
            os.remove(output_path)