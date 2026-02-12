"""
PDF to JSON Converter Utility
Standalone utility for converting VTU Result PDFs to JSON
Can be used independently or integrated with the main application
"""
from docling.document_converter import DocumentConverter
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions
import json
from pathlib import Path
from typing import Optional, Dict
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class PDFConverter:
    """PDF to JSON converter with OCR support"""
    
    def __init__(self):
        """Initialize the document converter with optimized settings"""
        # Configure PDF pipeline options
        pipeline_options = PdfPipelineOptions()
        pipeline_options.do_ocr = True
        pipeline_options.do_table_structure = True
        
        self.converter = DocumentConverter(
            format_options={
                InputFormat.PDF: pipeline_options
            }
        )
    
    def convert_to_json(
        self,
        pdf_path: str,
        output_path: Optional[str] = None,
        save_file: bool = True
    ) -> Dict:
        """
        Convert a PDF file to JSON format
        
        Args:
            pdf_path: Path to the PDF file
            output_path: Optional custom output path (default: same name as PDF with .json extension)
            save_file: Whether to save the JSON to a file (default: True)
        
        Returns:
            Dictionary containing the extracted document data
        """
        # Verify PDF exists
        pdf_file = Path(pdf_path)
        if not pdf_file.exists():
            raise FileNotFoundError(f"PDF file '{pdf_path}' not found!")
        
        logger.info(f"Converting {pdf_file.name}...")
        
        # Convert the PDF file
        result = self.converter.convert(str(pdf_file))
        
        # Export to dictionary
        doc_dict = result.document.export_to_dict()
        
        # Save to file if requested
        if save_file:
            if output_path is None:
                output_path = pdf_file.with_suffix('.json')
            else:
                output_path = Path(output_path)
            
            with output_path.open("w", encoding="utf-8") as f:
                json.dump(doc_dict, f, ensure_ascii=False, indent=2)
            
            logger.info(f"✓ JSON saved to {output_path}")
        
        return doc_dict
    
    def batch_convert(
        self,
        pdf_directory: str,
        output_directory: Optional[str] = None
    ) -> Dict[str, bool]:
        """
        Convert all PDFs in a directory to JSON
        
        Args:
            pdf_directory: Directory containing PDF files
            output_directory: Optional output directory (default: same as input)
        
        Returns:
            Dictionary with filename: success status
        """
        pdf_dir = Path(pdf_directory)
        if not pdf_dir.exists():
            raise FileNotFoundError(f"Directory '{pdf_directory}' not found!")
        
        output_dir = Path(output_directory) if output_directory else pdf_dir
        output_dir.mkdir(parents=True, exist_ok=True)
        
        results = {}
        pdf_files = list(pdf_dir.glob("*.pdf"))
        
        logger.info(f"Found {len(pdf_files)} PDF files")
        
        for pdf_file in pdf_files:
            try:
                output_path = output_dir / f"{pdf_file.stem}.json"
                self.convert_to_json(str(pdf_file), str(output_path))
                results[pdf_file.name] = True
            except Exception as e:
                logger.error(f"Failed to convert {pdf_file.name}: {str(e)}")
                results[pdf_file.name] = False
        
        return results


def main():
    """Command-line interface for PDF conversion"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Convert VTU Result PDFs to JSON')
    parser.add_argument('input', help='PDF file or directory path')
    parser.add_argument('-o', '--output', help='Output file or directory path')
    parser.add_argument('-b', '--batch', action='store_true', help='Batch mode for directory')
    
    args = parser.parse_args()
    
    converter = PDFConverter()
    
    try:
        if args.batch:
            results = converter.batch_convert(args.input, args.output)
            success = sum(1 for v in results.values() if v)
            total = len(results)
            print(f"\n✓ Converted {success}/{total} files successfully")
        else:
            converter.convert_to_json(args.input, args.output)
            print(f"\n✓ Conversion completed successfully")
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main())
