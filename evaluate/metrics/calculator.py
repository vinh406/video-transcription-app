import re
from jiwer import wer, cer


class MetricsCalculator:
    """Calculates metrics for transcription evaluation"""

    @staticmethod
    def calculate_wer(reference: str, hypothesis: str) -> float:
        """
        Calculate Word Error Rate between reference and hypothesis texts
        with normalization for case and punctuation

        Args:
            reference: Reference text
            hypothesis: Hypothesis text

        Returns:
            Word Error Rate (0-1)
        """

        # Normalize both texts (lowercase and remove punctuation)
        def normalize_text(text):
            # Convert to lowercase
            text = text.lower()
            # Remove punctuation
            text = re.sub(r"[^\w\s]", "", text)
            # Remove extra whitespace
            text = re.sub(r"\s+", " ", text).strip()
            return text

        normalized_reference = normalize_text(reference)
        normalized_hypothesis = normalize_text(hypothesis)

        # Calculate WER on normalized texts
        return wer(normalized_reference, normalized_hypothesis)

    @staticmethod
    def calculate_der(reference_diarization, hypothesis_diarization):
        """
        Calculate Diarization Error Rate (DER)

        Args:
            reference_diarization: Reference diarization segments with speaker labels
            hypothesis_diarization: Hypothesis diarization segments with speaker labels

        Returns:
            Diarization Error Rate (0-1)
        """
        from pyannote.core import Segment, Annotation
        from pyannote.metrics.diarization import DiarizationErrorRate

        # Create pyannote Annotation objects for reference and hypothesis
        reference = Annotation()
        hypothesis = Annotation()

        # Process reference diarization
        for i, segment in enumerate(reference_diarization):
            start = segment[0]
            end = segment[1]
            speaker = segment[2] if len(segment) > 2 else f"speaker_{i}"
            reference[Segment(start, end)] = speaker

        # Process hypothesis diarization
        for i, segment in enumerate(hypothesis_diarization):
            start = segment[0]
            end = segment[1]
            speaker = segment[2] if len(segment) > 2 else f"speaker_{i}"
            hypothesis[Segment(start, end)] = speaker

        # Calculate DER
        metric = DiarizationErrorRate()
        der_score = metric(reference, hypothesis)

        return der_score
    
    def calculate_cer(self, reference: str, hypothesis: str) -> float:
        """
        Calculate Character Error Rate between reference and hypothesis texts
        Particularly useful for character-based languages like Chinese
        
        Args:
            reference: Reference text
            hypothesis: Hypothesis text
            
        Returns:
            Character Error Rate (0-1)
        """
        # Normalize both texts
        def normalize_text(text):
            # Convert to lowercase
            text = text.lower()
            # Remove punctuation
            punctuation = r"""!"'＂＃＄％＆＇（）＊＋，－／：；＜＝＞＠［＼］＾＿｀｛｜｝～｟｠｢｣､、〃》「」『』【】〔〕〖〗〘〙〚〛〜〝〞〟〰〾〿–—‘’‛“”„‟…‧﹏。',.?、；：！~·#￥%……&*（）——+|{}【】‘’“”《》？。，、；："""
            text = text.translate(str.maketrans("", "", punctuation))
            # Add whitespace between chinese characters
            text = re.sub(r"([\u4e00-\u9fff])", r" \1 ", text)
            # Remove extra whitespace
            text = re.sub(r"\s+", " ", text).strip()
            print(f"Normalized text: {text}")
            
            return text
        
        normalized_reference = normalize_text(reference)
        normalized_hypothesis = normalize_text(hypothesis)
        
        # Calculate CER on normalized texts
        return wer(normalized_reference, normalized_hypothesis)