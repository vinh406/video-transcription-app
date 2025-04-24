import argparse
import os

from evaluate.datasets import CommonVoiceDataset, CallHomeDataset
from evaluate.services import TranscriptionService
from evaluate.evaluator import TranscriptionEvaluator


def main():
    """Main function to run the transcription evaluation"""
    parser = argparse.ArgumentParser(
        description="Evaluate transcription services on speech datasets"
    )

    # Common arguments
    parser.add_argument(
        "--service",
        type=str,
        default="elevenlabs",
        choices=["elevenlabs", "google", "whisperx"],
        help="Transcription service to use",
    )
    parser.add_argument(
        "--dataset",
        type=str,
        default="common_voice",
        choices=["common_voice", "callhome"],
        help="Dataset to evaluate on",
    )
    parser.add_argument("--language", type=str, default="en", help="Language code")
    parser.add_argument(
        "--results-dir",
        type=str,
        default=os.path.join("evaluate", "results"),
        help="Directory containing results files",
    )

    # Create subparsers for different modes
    subparsers = parser.add_subparsers(dest="mode", help="Operation mode")

    # Evaluation mode parser
    eval_parser = subparsers.add_parser("evaluate", help="Run evaluation on dataset")
    eval_parser.add_argument("--split", type=str, default="test", help="Dataset split")
    eval_parser.add_argument(
        "--limit", type=int, default=0, help="Maximum samples to process"
    )

    # Report generation mode parser
    report_parser = subparsers.add_parser(
        "report", help="Generate report from existing results"
    )
    report_parser.add_argument(
        "--results-file",
        type=str,
        help="Specific results file to use (default: auto-detect based on service and dataset)",
    )

    args = parser.parse_args()

    # Set default mode if not specified
    if not args.mode:
        args.mode = "evaluate"

    # Create dataset based on argument
    if args.dataset == "common_voice":
        dataset = CommonVoiceDataset(args.language)
    elif args.dataset == "callhome":
        dataset = CallHomeDataset(args.language)
    else:
        raise ValueError(f"Unknown dataset: {args.dataset}")

    # Create transcription service
    service = TranscriptionService(args.service)

    # Create evaluator with specified results directory
    evaluator = TranscriptionEvaluator(dataset, service, None, args.results_dir)

    if args.mode == "evaluate":
        # Run evaluation
        print(
            f"Testing {args.service.upper()} on {args.dataset.upper()} dataset ({args.language})"
        )
        evaluator.evaluate(args.split, args.limit)

    elif args.mode == "report":
        # Generate report from existing results
        print(
            f"Generating report for {args.service.upper()} on {args.dataset.upper()} dataset ({args.language})"
        )
        evaluator.generate_report(args.results_file)


if __name__ == "__main__":
    main()
