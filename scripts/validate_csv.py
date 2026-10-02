import argparse
import csv
import re
import sys

def main():
    parser = argparse.ArgumentParser(description="Validate data.csv and notes.csv format.")
    parser.add_argument("--report", dest="report_file", help="Path to write Markdown validation report.")
    args = parser.parse_args()

    errors = []
    warnings = []
    notes_ids = set()

    # Validate notes.csv
    try:
        with open('notes.csv', 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            try:
                notes_header = next(reader)
            except StopIteration:
                errors.append("notes.csv is empty")
                notes_header = []

            notes_header_len = len(notes_header)
            if notes_header and notes_header_len < 2:
                errors.append(f"notes.csv must have at least 2 columns, got {notes_header_len}")

            if notes_header:
                for row_num, row in enumerate(reader, start=2):
                    if len(row) != notes_header_len:
                        errors.append(f"notes.csv row {row_num} has {len(row)} columns, expected {notes_header_len}")
                    if not row or not row[0].isdigit():
                        val = row[0] if row else ""
                        errors.append(f"notes.csv row {row_num} id is not a number: '{val}'")
                    else:
                        notes_ids.add(row[0])
    except FileNotFoundError:
        errors.append("notes.csv not found")
    except Exception as e:
        errors.append(f"Error reading notes.csv: {e}")

    # Validate data.csv
    try:
        with open('data.csv', 'r', encoding='utf-8') as f:
            # Use strict=True to catch unescaped quotes
            reader = csv.reader(f, strict=True)
            try:
                data_header = next(reader)
            except StopIteration:
                errors.append("data.csv is empty")
                data_header = []

            if data_header:
                header_len = len(data_header)
                for row_num, row in enumerate(reader, start=2):
                    if len(row) != header_len:
                        errors.append(f"data.csv row {row_num} has {len(row)} columns, expected {header_len}")
                        continue

                    # Check footnotes in cells [id]
                    for col_idx, cell in enumerate(row):
                        footnotes = re.findall(r'\[(\d+)\]', cell)
                        for fn in footnotes:
                            if fn not in notes_ids:
                                errors.append(f"data.csv row {row_num}, column '{data_header[col_idx]}' references unknown footnote [{fn}]")

                    # Check Multi-Gig port format (column 8)
                    mg_idx = 8
                    if mg_idx < len(row):
                        raw_mg = row[mg_idx].split('|')[0].strip()
                        # Accept: "Нет", or "{N}x {Speed}G" (e.g. 1x 2.5G, 2x 2.5G, 1x 10G, 2x 10G)
                        valid_mg = raw_mg == "Нет" or bool(re.match(r'^\d+x\s+(?:2\.5|5|10)G$', raw_mg))
                        if not valid_mg:
                            warnings.append(f"data.csv row {row_num} ('{row[0]}') has non-standard Multi-Gig format: '{row[mg_idx]}'. Recommended: 'Нет', '1x 2.5G', '2x 2.5G', etc.")

                    # Check Availability format (column 14)
                    avail_idx = 14
                    if avail_idx < len(row):
                        raw_avail = row[avail_idx].split('|')[0].strip()
                        known_parts = {"Маркетплейсы", "Розница", "Китай", "Снят с продажи", "ТГ чат"}
                        parts = [p.strip() for p in raw_avail.split('/')]
                        unknown = [p for p in parts if p not in known_parts]
                        if unknown:
                            warnings.append(f"data.csv row {row_num} ('{row[0]}') has non-standard Availability channel(s): {unknown} in '{row[avail_idx]}'.")
    except FileNotFoundError:
        errors.append("data.csv not found")
    except csv.Error as e:
        errors.append(f"CSV parsing error: {e}")
    except Exception as e:
        errors.append(f"Error reading data.csv: {e}")

    # Generate Markdown report if requested
    if args.report_file:
        report_lines = ["<!-- csv-validation-comment -->"]
        if errors:
            report_lines.append("### ❌ Проверка CSV не пройдена\n")
            report_lines.append(f"Обнаружены критические ошибки (**{len(errors)}**):\n")
            for err in errors:
                report_lines.append(f"- {err}")
            if warnings:
                report_lines.append(f"\nТакже обнаружены предупреждения (**{len(warnings)}**):\n")
                for w in warnings:
                    report_lines.append(f"- {w}")
            report_lines.append("\n> Пожалуйста, исправьте ошибки перед слиянием PR.")
        elif warnings:
            report_lines.append("### ⚠️ Проверка CSV пройдена с предупреждениями\n")
            report_lines.append(f"Критических ошибок нет, но обратите внимание на форматирование (**{len(warnings)}**):\n")
            for w in warnings:
                report_lines.append(f"- {w}")
            report_lines.append("\n> Рекомендуется привести форматирование к единому стилю.")
        else:
            report_lines.append("### ✅ Все проверки CSV пройдены успешно!\n")
            report_lines.append("Файлы `data.csv` и `notes.csv` полностью соответствуют правилам репозитория. Ошибок и предупреждений не обнаружено.")

        with open(args.report_file, 'w', encoding='utf-8') as rf:
            rf.write("\n".join(report_lines) + "\n")

    # Output to stdout/stderr
    for err in errors:
        print(f"Error: {err}", file=sys.stderr)
    for w in warnings:
        print(f"Warning: {w}")

    if errors:
        sys.exit(1)

    print("CSV validation passed.")
    sys.exit(0)

if __name__ == "__main__":
    main()
