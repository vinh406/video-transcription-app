from abc import ABC, abstractmethod
import os
from typing import Any, Dict, List, Tuple

import pandas as pd

from evaluate.metrics.calculator import MetricsCalculator


class BaseDataset(ABC):
    """Abstract base class for speech datasets"""

    def __init__(self, language: str, output_dir: str = "."):
        """
        Initialize the dataset

        Args:
            language: Language code
            output_dir: Directory to save results
        """
        self.language = language
        self.output_dir = output_dir
        self.metrics = MetricsCalculator()
        os.makedirs(output_dir, exist_ok=True)

    @abstractmethod
    def load(self, split: str, limit: int) -> Any:
        """
        Load the dataset

        Args:
            split: Dataset split (e.g., "train", "test", "validation")
            limit: Maximum number of samples to load

        Returns:
            Loaded dataset
        """
        pass

    def prepare_audio(self, sample, sample_id: int) -> str:
        """
        Prepare audio from a Common Voice sample

        Args:
            sample: Dataset sample
            sample_id: Sample ID

        Returns:
            Path to the audio file
        """
        audio = sample["audio"]
        temp_path = os.path.join(self.temp_dir, f"sample_{sample_id}.wav")

        if isinstance(audio, dict):
            if "array" in audio and "sampling_rate" in audio:
                # Convert numpy array to WAV
                import soundfile as sf

                sf.write(temp_path, audio["array"], audio["sampling_rate"])
            else:
                raise KeyError(
                    f"Could not find audio data in expected format. Available keys: {audio.keys()}"
                )
        else:
            # Write raw audio bytes to file
            with open(temp_path, "wb") as f:
                f.write(audio)

        return temp_path

    def get_results_path(self, service_name: str) -> str:
        """
        Get path for results CSV

        Args:
            service_name: Name of the transcription service

        Returns:
            Path to results CSV
        """
        return os.path.join(
            self.output_dir,
            f"{service_name}_{self.dataset_name}_{self.language}_results.csv",
        )

    def get_processed_ids(self, results_path: str) -> Tuple[set, List[Dict]]:
        """
        Get IDs of already processed samples

        Args:
            results_path: Path to results CSV

        Returns:
            Set of processed IDs and list of existing results
        """
        processed_ids = set()
        existing_results = []

        if os.path.exists(results_path):
            try:
                df = pd.read_csv(results_path)
                processed_ids = set(df["sample_id"].astype(int).tolist())
                existing_results = df.to_dict("records")
                print(f"Found existing CSV with {len(processed_ids)} processed samples")
            except Exception as e:
                print(f"Error reading existing CSV: {e}")

        return processed_ids, existing_results

    def save_results(
        self, results: List[Dict], results_path: str
    ) -> None:
        """
        Save results to CSV

        Args:
            results: List of result dictionaries
            results_path: Path to save CSV
            exclude_keys: Keys to exclude from CSV
        """
        if not results:
            return

        for result in results:
            if "sample" in result and "audio" in result["sample"]:
                del result["sample"]["audio"]

        df = pd.DataFrame(results)
        df.to_csv(results_path, index=False)

    @abstractmethod
    def calculate_metrics(self, results: List[Dict]) -> Dict[str, float]:
        """
        Calculate dataset-specific evaluation metrics

        Args:
            results: List of result dictionaries with reference and transcribed text

        Returns:
            Dictionary of metric names and values
        """
        pass

    def generate_report(self, results: List[Dict], service_name: str) -> Dict[str, Any]:
        """
        Generate evaluation report with metrics and statistics

        Args:
            results: List of result dictionaries
            service_name: Name of the transcription service

        Returns:
            Dictionary with report data
        """
        df = pd.DataFrame(
            [{k: v for k, v in r.items() if k != "response"} for r in results]
        )

        # Calculate dataset-specific metrics
        metrics = self.calculate_metrics(results)

        # Calculate processing time statistics
        time_stats = {}
        if "processing_time" in df.columns and not df.empty:
            time_stats["avg_time"] = df["processing_time"].mean()
            time_stats["total_time"] = df["processing_time"].sum()
            time_stats["total_minutes"] = time_stats["total_time"] / 60

        # Compile report
        report = {
            "service": service_name,
            "dataset": self.dataset_name,
            "language": self.language,
            "samples": len(df),
            "metrics": metrics,
            "time_stats": time_stats,
        }

        print(
            f"\nResults for {report['service']} on {report['dataset']} dataset ({report['language']}):"
        )
        print(f"Total samples processed: {report['samples']}")

        # Print metrics
        for metric_name, metric_value in report["metrics"].items():
            if isinstance(metric_value, float):
                print(f"{metric_name}: {metric_value:.4f} ({metric_value * 100:.2f}%)")
            else:
                print(f"{metric_name}: {metric_value}")

        # Print time statistics
        if report["time_stats"]:
            avg_time = report["time_stats"].get("avg_time")
            total_time = report["time_stats"].get("total_time")
            total_minutes = report["time_stats"].get("total_minutes")

            if avg_time is not None:
                print(f"Average processing time: {avg_time:.2f} seconds")
            if total_time is not None and total_minutes is not None:
                print(
                    f"Total processing time: {total_time:.2f} seconds ({total_minutes:.2f} minutes)"
                )

        return report