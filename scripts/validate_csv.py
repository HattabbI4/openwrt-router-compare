import csv
import sys
import re

def main():

    notes_ids = set()
    
    # Validate notes.csv
    with open('notes.csv', 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        try:
            notes_header = next(reader)
        except StopIteration:
            print("Error: notes.csv is empty")
            sys.exit(1)
            
        notes_header_len = len(notes_header)
        if notes_header_len < 2:
            print(f"Error: notes.csv must have at least 2 columns, got {notes_header_len}")
            sys.exit(1)
            
        for row_num, row in enumerate(reader, start=2):
            if len(row) != notes_header_len:
                print(f"Error: notes.csv row {row_num} has {len(row)} columns, expected {notes_header_len}")
                sys.exit(1)
            if not row[0].isdigit():
                print(f"Error: notes.csv row {row_num} id is not a number: {row[0]}")
                sys.exit(1)
            notes_ids.add(row[0])
            
    # Validate data.csv
    with open('data.csv', 'r', encoding='utf-8') as f:
        # Use strict=True to catch unescaped quotes
        reader = csv.reader(f, strict=True)
        try:
            data_header = next(reader)
        except StopIteration:
            print("Error: data.csv is empty")
            sys.exit(1)
            
        header_len = len(data_header)
        
        for row_num, row in enumerate(reader, start=2):
            if len(row) != header_len:
                print(f"Error: data.csv row {row_num} has {len(row)} columns, expected {header_len}")
                sys.exit(1)
                
            # Check footnotes in cells [id]
            for col_idx, cell in enumerate(row):
                footnotes = re.findall(r'\[(\d+)\]', cell)
                for fn in footnotes:
                    if fn not in notes_ids:
                        print(f"Error: data.csv row {row_num}, column '{data_header[col_idx]}' references unknown footnote [{fn}]")
                        sys.exit(1)

            # Check Multi-Gig port format (column 8)
            mg_idx = 8
            if mg_idx < len(row):
                raw_mg = row[mg_idx].split('|')[0].strip()
                # Accept: "Нет", or "{N}x {Speed}G" (e.g. 1x 2.5G, 2x 2.5G, 1x 10G, 2x 10G)
                valid_mg = raw_mg == "Нет" or bool(re.match(r'^\d+x\s+(?:2\.5|5|10)G$', raw_mg))
                if not valid_mg:
                    print(f"Warning: data.csv row {row_num} ('{row[0]}') has non-standard Multi-Gig format: '{row[mg_idx]}'. Recommended: 'Нет', '1x 2.5G', '2x 2.5G', etc.")

            # Check Availability format (column 14)
            avail_idx = 14
            if avail_idx < len(row):
                raw_avail = row[avail_idx].split('|')[0].strip()
                known_parts = {"Маркетплейсы", "Розница", "Китай", "Снят с продажи", "ТГ чат"}
                parts = [p.strip() for p in raw_avail.split('/')]
                unknown = [p for p in parts if p not in known_parts]
                if unknown:
                    print(f"Warning: data.csv row {row_num} ('{row[0]}') has non-standard Availability channel(s): {unknown} in '{row[avail_idx]}'.")

    print("CSV validation passed.")

if __name__ == "__main__":
    try:
        main()
    except csv.Error as e:
        print(f"CSV parsing error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)
