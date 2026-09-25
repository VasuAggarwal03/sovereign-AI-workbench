from faster_whisper import WhisperModel


MODEL_SIZE = "base"

model = WhisperModel(
    MODEL_SIZE,
    device="cpu",
    compute_type="int8",
)


def transcribe_audio(audio_path: str) -> str:
    """
    Convert speech audio into text using local Whisper.
    """

    segments, info = model.transcribe(
        audio_path,
        beam_size=5,
    )

    text = " ".join(
        segment.text.strip()
        for segment in segments
    )

    return text.strip()