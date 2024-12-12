# pl-single-csv-upload
PrairieLearn element for uploading a single CSV file with required keys. This work is conducted at the University of California, San Diego.

This element asks the student to upload a single CSV file. The file header is parse on the client side, which allows students to choose which columns in their file correspond to the required columns as specified by the instructor.

## Installation
To install, create a directory name `pl-single-csv-upload` in the `elements` subdirectory of your course. Then, copy all four files in this repository to that directory.

## Documentation
The element itself requires two attributes:
- `file-name` is the name it will preset the result to us. The student need not use this name.
- `column-names` is a (comma-separated) list of column names we want present in the file.

To the grading script, a successful submission creates `data["submitted_answers"][file-name]`. This is a dictionary with two keys:
- `data["submitted_answers"][file-name]["content"]` is the content of the CSV, base 64-encoded
- `data["submitted_answers"][file-name]["column_names"]` is a dictionary from "our" column names to "student" column names.

## Examples
Example element invocation:
```html
<pl-single-csv-upload column-names="Voltage,Time" file-name="student-data.csv"></pl-single-csv-upload>
```

Example processing code:
```python
import base64
from io import BytesIO
import pandas as pd

def filter_csv_submission(data, file_name: str, required_column_names: list[str]) -> pd.DataFrame | str:
    if file_name not in data["submitted_answers"] or not data["submitted_answers"][file_name]:
        return "You didn't submit a CSV file"
    submitted_file = data["submitted_answers"][file_name]
    specified_column_names = submitted_file["column_names"]
    raw_data_file = BytesIO(base64.b64decode(submitted_file["content"]))
    raw_data = pd.read_csv(raw_data_file)
    student_column_names = [specified_column_names[name] if name in specified_column_names else name for name in required_column_names]
    missing_columns = [name for name in student_column_names if name not in raw_data.columns]
    if missing_columns:
        # Some of the specified columns are missing
        return f"Your CSV file is missing the following columns: {missing_columns}"
    new_dataframe = raw_data[student_column_names]
    # Rename to our names
    new_dataframe.columns = required_column_names
    return new_dataframe

# Call this in `grade()`:
student_data = filter_csv_submission(data, "student-data.csv", ["Voltage", "Time"])
```
