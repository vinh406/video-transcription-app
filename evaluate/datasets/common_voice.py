from typing import Any, Dict, List
import os

from datasets import load_dataset

from evaluate.datasets.base import BaseDataset
from evaluate.metrics.calculator import MetricsCalculator


class CommonVoiceDataset(BaseDataset):
    """Mozilla Common Voice dataset handler"""

    def __init__(self, language: str, output_dir: str = "."):
        super().__init__(language, output_dir)
        self.dataset_name = "common_voice"
        self.temp_dir = os.path.join(output_dir, "temp_audio")
        os.makedirs(self.temp_dir, exist_ok=True)

    def load(self, split: str, limit: int) -> Any:
        """
        Load Common Voice dataset

        Args:
            split: Dataset split ("train", "test", "validation")
            limit: Maximum number of samples to load

        Returns:
            Loaded dataset
        """
        print(
            f"Loading Common Voice dataset for language '{self.language}', split '{split}'..."
        )
        try:
            if self.language == "mixed":
                print("Creating mixed English-Vietnamese dataset...")
                # Load English and Vietnamese datasets with streaming=True
                en_dataset = load_dataset(
                    "mozilla-foundation/common_voice_11_0",
                    "en",
                    split=split,
                    streaming=True
                )
                vi_dataset = load_dataset(
                    "mozilla-foundation/common_voice_11_0",
                    "vi",
                    split=split,
                    streaming=True
                )
                
                # Create iterators for streaming datasets
                en_iter = iter(en_dataset)
                vi_iter = iter(vi_dataset)
                
                # Create mixed dataset
                mixed_dataset = []
                import numpy as np
                
                # Set sample limit
                sample_limit = limit if limit > 0 else 1237
                
                for i in range(sample_limit):
                    try:
                        # Get next sample from each iterator
                        en_sample = next(en_iter)
                        vi_sample = next(vi_iter)
                        
                        # Get audio arrays
                        en_audio = en_sample["audio"]["array"] 
                        vi_audio = vi_sample["audio"]["array"]
                        
                        # Concatenate audio sequentially (English first, then Vietnamese)
                        mixed_audio = np.concatenate([en_audio, vi_audio])
                        
                        # Create mixed sample
                        mixed_sample = {
                            "id": f"mixed_{i}",
                            "audio": {
                                "array": mixed_audio,
                                "sampling_rate": en_sample["audio"]["sampling_rate"],
                            },
                            "sentence": f"{en_sample['sentence']} {vi_sample['sentence']}",
                            "en_sentence": en_sample["sentence"],
                            "vi_sentence": vi_sample["sentence"],
                        }
                        mixed_dataset.append(mixed_sample)
                        
                            
                    except StopIteration:
                        break
                
                return mixed_dataset
            else:
                # Regular loading for non-mixed languages
                dataset = load_dataset(
                    "mozilla-foundation/common_voice_11_0",
                    self.language,
                    split=split,
                    streaming=True,
                )
                return dataset
        except Exception as e:
            print(f"Error loading dataset: {e}")
            return None

    def calculate_metrics(self, results: List[Dict]) -> Dict[str, float]:
        """
        Calculate metrics specific to CommonVoice dataset (WER)

        Args:
            results: List of result dictionaries with reference and transcribed text

        Returns:
            Dictionary with WER metric
        """
        metrics_calc = MetricsCalculator()

        # Concatenate all texts for overall WER
        all_references = "\n".join([str(r["reference_text"]) for r in results])
        all_transcriptions = "\n".join([str(r["transcribed_text"]) for r in results])

        # Calculate overall WER
        overall_wer = metrics_calc.calculate_wer(all_references, all_transcriptions)

        return {"WER": overall_wer}

    def save_results(self, results, results_path):
        """
        Extract relevant data from responses and save results to CSV

        Args:
            results: List of result dictionaries (may include raw 'response')
            results_path: Path to save CSV
            exclude_keys: Keys to exclude from CSV (defaults to ['response'])
        """

        if not results:
            return

        # Process each result to extract needed information from response if not already extracted
        processed_results = []
        for result in results:
            # Start with the basic fields
            if "response" in result:
                processed_result = {"sample_id": result.get("sample_id")}
                sample = result.get("sample")
                if sample:
                    processed_result["reference_text"] = sample.get("sentence")

                response = result["response"]
                if "text" in response:
                    processed_result["transcribed_text"] = response["text"]
                elif "segments" in response and len(response["segments"]) > 0:
                    processed_result["transcribed_text"] = " ".join(
                        segment.get("text", "") for segment in response["segments"]
                    )
                else:
                    processed_result["transcribed_text"] = ""
                processed_result["processing_time"] = result["response"][
                    "processing_time"
                ]
                processed_results.append(processed_result)
            else:
                processed_results.append(result)
                
        return super().save_results(processed_results, results_path)
