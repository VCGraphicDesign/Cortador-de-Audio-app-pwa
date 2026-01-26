
import os

def check_xml_files(directory):
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith('.xml'):
                filepath = os.path.join(root, file)
                try:
                    with open(filepath, 'rb') as f:
                        header = f.read(100)
                        if not header:
                            print(f"Empty XML: {filepath}")
                            continue
                        # Check for BOM
                        if header.startswith(b'\xef\xbb\xbf'):
                            print(f"BOM found in: {filepath}")
                        # Check first character
                        content = header.decode('utf-8', errors='ignore').strip()
                        if content and not content.startswith('<'):
                            print(f"Malformed XML (starts with {content[0]}): {filepath}")
                except Exception as e:
                    print(f"Error reading {filepath}: {e}")

if __name__ == "__main__":
    check_xml_files('android')
