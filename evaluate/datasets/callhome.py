import os
from typing import Any, Dict, List

from datasets import load_dataset

from evaluate.datasets.base import BaseDataset
from evaluate.metrics.calculator import MetricsCalculator


class CallHomeDataset(BaseDataset):
    """TalkBank/CallHome dataset handler for speaker diarization"""

    def __init__(self, language: str, output_dir: str = "."):
        super().__init__(language, output_dir)
        self.dataset_name = "callhome"
        self.temp_dir = os.path.join(output_dir, "temp_audio")
        os.makedirs(self.temp_dir, exist_ok=True)

    def load(self, split: str, limit: int) -> Any:
        """
        Load CallHome dataset

        Args:
            split: Dataset split
            limit: Maximum number of samples to load

        Returns:
            Loaded dataset
        """
        print(f"Loading CallHome dataset for language '{self.language}'...")
        try:
            dataset = load_dataset(
                "diarizers-community/callhome", self.language, split="data"
            )
            return dataset
        except Exception as e:
            print(f"Error loading dataset: {e}")
            return None


    def save_results(self, results, results_path):
        """
        Save results to CSV with only sample_id, DER, and processing_time
        
        Args:
            results: List of result dictionaries
            results_path: Path to save CSV
        """
        if not results:
            return
            
        # Process results to extract only needed fields
        processed_results = []
        for result in results:
            # Create a basic result with sample_id
            processed_result = {
                "sample_id": result.get("sample_id")
            }
            
            # Extract processing time
            if "processing_time" in result:
                processed_result["processing_time"] = result["processing_time"]
            elif "response" in result and "processing_time" in result["response"]:
                processed_result["processing_time"] = result["response"]["processing_time"]
            else:
                processed_result["processing_time"] = 0
                
            # Calculate DER for this sample if not already calculated
            if "der" in result:
                processed_result["reference"] = result.get("reference")
                processed_result["hypothesis"] = result.get("hypothesis")
                processed_result["der"] = result["der"]
            elif "response" in result and "segments" in result["response"]:
                # Extract reference and hypothesis diarization
                sample = result.get("sample", {})
                reference_diarization = []
                for timestamps_start, timestamps_end, speaker in zip(
                    sample.get("timestamps_start", []),
                    sample.get("timestamps_end", []),
                    sample.get("speakers", []),
                ):
                    reference_diarization.append([
                        timestamps_start,
                        timestamps_end,
                        speaker,
                    ])
                
                # Build hypothesis diarization from segments
                hypothesis_diarization = []
                for segment in result["response"]["segments"]:
                    hypothesis_diarization.append([
                        segment.get("start", 0),
                        segment.get("end", 0),
                        segment.get("speaker", "unknown"),
                    ])
                    
                # Calculate DER if both reference and hypothesis are available
                metrics_calc = MetricsCalculator()
                sample_der = metrics_calc.calculate_der(
                    reference_diarization, hypothesis_diarization
                )
                processed_result["reference"] = reference_diarization
                processed_result["hypothesis"] = hypothesis_diarization
                processed_result["der"] = sample_der
                    
            processed_results.append(processed_result)

        # Create DataFrame with only the required columns
        import pandas as pd
        df = pd.DataFrame(processed_results)
        
        # Ensure columns are in the desired order
        columns = ["sample_id", "reference", "hypothesis", "der", "processing_time"]
        df = df.reindex(columns=columns)
        
        # Save to CSV
        df.to_csv(results_path, index=False)
        

    def calculate_metrics(self, results: List[Dict]) -> Dict[str, float]:
        """
        Calculate metrics specific to CallHome dataset (DER)
        
        Args:
            results: List of result dictionaries with diarization segments
            
        Returns:
            Dictionary with DER metric
        """
        
        # Initialize total error
        total_der = 0.0
        sample_count = 0
        
        # Calculate DER for each sample and average them
        for result in results:
            total_der += result["der"]
            sample_count += 1
        
        # Calculate average DER
        avg_der = total_der / sample_count if sample_count > 0 else 0.0
        
        return {"DER": avg_der}