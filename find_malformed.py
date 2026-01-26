
import os

def find_malformed_xml(path):
    for root, dirs, files in os.walk(path):
        if 'build' in root:
            continue
        for file in files:
            if file.endswith('.xml'):
                fullname = os.path.join(root, file)
                try:
                    with open(fullname, 'rb') as f:
                        content = f.read()
                        if not content:
                            continue
                        # Skip UTF-8 BOM
                        start = 0
                        if content.startswith(b'\xef\xbb\xbf'):
                            start = 3
                        
                        # Find first non-whitespace
                        while start < len(content) and content[start] in b' \n\r\t':
                            start += 1
                        
                        if start < len(content) and content[start] != ord('<'):
                            print(f"MALFORMED: {fullname} starts with {content[start:start+1]}")
                except:
                    pass

if __name__ == '__main__':
    find_malformed_xml('android')
