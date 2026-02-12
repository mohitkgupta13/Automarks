"""
Debug script to see what's actually in the PDF files
"""
from pypdf import PdfReader
import sys
import os

def debug_pdf(pdf_path):
    """Print raw text from PDF to see what we're working with"""
    print(f"\n{'='*80}")
    print(f"DEBUG: {pdf_path}")
    print(f"{'='*80}\n")
    
    if not os.path.exists(pdf_path):
        print(f"ERROR: File not found: {pdf_path}")
        return
    
    try:
        reader = PdfReader(pdf_path)
        print(f"Number of pages: {len(reader.pages)}\n")
        
        for i, page in enumerate(reader.pages, 1):
            print(f"\n--- PAGE {i} ---")
            text = page.extract_text() or ""
            print(text[:2000])  # Print first 2000 chars
            print(f"\n... (Total {len(text)} characters)")
            
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    # Check if PDF path provided as argument
    if len(sys.argv) > 1:
        debug_pdf(sys.argv[1])
    else:
        # Test with the first PDF in raw folder
        raw_folder = r"c:\Users\ANJAN27_new\OneDrive\Desktop\Demo\data\raw"
        
        if os.path.exists(raw_folder):
            files = [f for f in os.listdir(raw_folder) if f.endswith('.pdf')]
            if files:
                # Test first file
                test_file = os.path.join(raw_folder, files[0])
                debug_pdf(test_file)
            else:
                print("No PDF files found in raw folder")
                print(f"\nUsage: python test_pdf_content.py <path_to_pdf>")
        else:
            print(f"Raw folder not found: {raw_folder}")
            print(f"\nUsage: python test_pdf_content.py <path_to_pdf>")
