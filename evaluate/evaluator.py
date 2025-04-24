import os
import time

import pandas as pd

from evaluate.datasets.base import BaseDataset
from evaluate.services import TranscriptionService


class TranscriptionEvaluator:
    """Evaluates transcription services on datasets"""

    def __init__(
        self,
        dataset: BaseDataset,
        service: TranscriptionService,
        results_dir: str = os.path.join("evaluate", "results"),
    ):
        """
        Initialize evaluator

        Args:
            dataset: Dataset to evaluate on
            service: Transcription service to use
            results_dir: Directory to save results (default: "results")
        """
        self.dataset = dataset
        self.service = service
        self.results_dir = results_dir

        # Create results directory if it doesn't exist
        os.makedirs(self.results_dir, exist_ok=True)

    def evaluate(self, split: str, limit: int) -> pd.DataFrame:
        """
        Evaluate transcription service on dataset

        Args:
            split: Dataset split to use
            limit: Maximum number of samples to process

        Returns:
            DataFrame with evaluation results
        """
        # Load dataset
        dataset_data = self.dataset.load(split=split, limit=limit)
        if dataset_data is None:
            return None

        # Get original path for results CSV from dataset
        original_results_path = self.dataset.get_results_path(self.service.service_name)

        # Modify path to save in results directory
        filename = os.path.basename(original_results_path)
        results_path = os.path.join(self.results_dir, filename)

        # Get already processed samples if skipping
        processed_ids, existing_results = self.dataset.get_processed_ids(results_path)

        # Start with existing results
        results = existing_results.copy()

        # Count how many new samples to process
        if limit > 0:
            samples_to_process = limit - len(processed_ids)
        else:
            samples_to_process = len(dataset_data) - len(processed_ids)
        if samples_to_process <= 0:
            print(
                f"All {limit} samples have already been processed. Nothing new to do."
            )
            return pd.DataFrame(results)

        print(
            f"Will process up to {samples_to_process} new samples using {self.service.service_name} API..."
        )

        # Track processed count
        processed_count = 0

        # Process samples
        for i, sample in enumerate(dataset_data):
            # Get sample ID (depends on dataset format)
            sample_id = i

            # Skip if already processed
            if sample_id in processed_ids:
                continue

            # Stop if reached limit
            if processed_count >= samples_to_process:
                break

            processed_count += 1

            try:
                # Prepare audio for transcription
                temp_path = self.dataset.prepare_audio(sample, sample_id)


                # Transcribe audio
                response = self.service.transcribe(
                    audio_path=temp_path,
                    language=self.dataset.language,
                )

                # Store raw results with minimal processing
                result = {
                    "sample_id": sample_id,
                    "sample": sample,
                    "response": response,
                }

                results.append(result)

                # Print progress
                print(f"\nSample {sample_id} ({self.service.service_name}):")
                print(
                    f"Processing time: {response.get('processing_time', 0):.2f} seconds"
                )

                self.dataset.save_results(results, results_path)

                # Add delay to avoid rate limiting
                time.sleep(2)

            except Exception as e:
                print(f"Error processing sample {sample_id}: {str(e)}")
                break

            finally:
                # Clean up temporary file
                if (
                    "temp_path" in locals()
                    and os.path.exists(temp_path)
                    and temp_path.startswith(self.dataset.temp_dir)
                ):
                    os.remove(temp_path)

        # Calculate overall metrics
        if results:
            # Generate report from saved results
            self.generate_report()

        return pd.DataFrame([r for r in results if "response" not in r])

    def generate_report(self, results_filename: str = None) -> dict:
        """
        Generate report from existing results without running evaluation again

        Args:
            results_filename: Optional specific results filename to use
                            If None, will use the default naming pattern

        Returns:
            Report dictionary with metrics and statistics
        """
        # Determine results path
        if results_filename:
            results_path = os.path.join(self.results_dir, results_filename)
        else:
            original_results_path = self.dataset.get_results_path(
                self.service.service_name
            )
            filename = os.path.basename(original_results_path)
            results_path = os.path.join(self.results_dir, filename)

        # Check if results file exists
        if not os.path.exists(results_path):
            print(f"Results file not found: {results_path}")
            return None

        # Load results from CSV
        try:
            df = pd.read_csv(results_path)
            results = df.to_dict("records")
            print(f"Loaded {len(results)} results from {results_path}")

            # Generate evaluation report using dataset-specific metrics
            report = self.dataset.generate_report(results, self.service.service_name)

            return report

        except Exception as e:
            print(f"Error generating report: {str(e)}")
            return None
