import base64
import csv
import hashlib
import json
from io import StringIO

import chevron
import lxml.html
import prairielearn as pl


def get_clist_as_array(raw_clist_names: str) -> list[str]:
    reader = csv.reader(
        StringIO(raw_clist_names),
        delimiter=",",
        escapechar="\\",
        quoting=csv.QUOTE_NONE,
        skipinitialspace=True,
        strict=True,
    )
    return next(reader)


# Each pl-single-csv-upload element is uniquely identified by the SHA1 hash of its
# file_name attribute
def get_answer_name(file_name: str) -> str:
    hashname = hashlib.sha1(file_name.encode("utf-8")).hexdigest()
    return f"_single_csv_upload_{hashname}"

# Generate a unique key for each column name
def get_column_key(column_name: str, answer_name: str) -> str:
    encoded = base64.b16encode(column_name.encode()).decode()
    return f"{answer_name}_col_{encoded}"


def prepare(element_html: str, data: pl.QuestionData) -> None:
    element = lxml.html.fragment_fromstring(element_html)
    required_attribs = ["column-names", "file-name"]
    optional_attribs = []
    pl.check_attribs(element, required_attribs, optional_attribs)

    if "_required_column_names" not in data["params"]:
        data["params"]["_required_column_names"] = []
    column_names = get_clist_as_array(pl.get_string_attrib(element, "column-names"))
    data["params"]["_required_column_names"].extend(column_names)


def render(element_html: str, data: pl.QuestionData) -> str:
    if data["panel"] != "question":
        return ""

    element = lxml.html.fragment_fromstring(element_html)
    uuid = pl.get_uuid()

    raw_column_names = pl.get_string_attrib(element, "column-names")
    file_name = pl.get_string_attrib(element, "file-name")
    answer_name = get_answer_name(file_name)
    column_names = get_clist_as_array(raw_column_names)
    column_names_json = json.dumps(column_names, allow_nan=False)
    column_names_rich = [{"col_text": name, "col_key": get_column_key(name, answer_name)} for name in column_names]
    # This is for restoring the user's original submission during editing
    # Should be a string of base64 data, but JSON just to be safe
    old_submission = json.dumps(data["submitted_answers"].get(file_name, None), allow_nan=False)
    # A dictionary of column names to user-supplied names
    old_column_assignments = data["submitted_answers"].get(file_name + "_column_names", {})
    # Transform it to {col-key: user-supplied-name}
    old_column_assignments = {get_column_key(k, answer_name): v for k, v in old_column_assignments.items()}
    old_column_assignments_json = json.dumps(old_column_assignments, allow_nan=False)

    html_params = {
        "name": answer_name,
        "file_name": file_name,
        "column_names": column_names_rich,
        "column_names_json": column_names_json,
        "old_submission_json": old_submission,
        "old_column_assignments_json": old_column_assignments_json,
        "uuid": uuid,
        "editable": data["editable"],
    }

    with open("pl-single-csv-upload.mustache", "r", encoding="utf-8") as f:
        return chevron.render(f, html_params).strip()


def parse(element_html: str, data: pl.QuestionData) -> None:
    element = lxml.html.fragment_fromstring(element_html)
    raw_column_names = pl.get_string_attrib(element, "column-names")
    file_name = pl.get_string_attrib(element, "file-name")
    answer_name = get_answer_name(file_name)

    # Get submitted answer or return parse_error if it does not exist
    file_content = data["submitted_answers"].get(answer_name, None)
    if not file_content:
        pl.add_files_format_error(data, "No submitted answer for single CSV upload.")
        return
    # Move the file content to a user-friendly key
    del data["submitted_answers"][answer_name]
    data["submitted_answers"][file_name] = file_content

    # Convert the column names to a dictionary for easy access
    column_names = get_clist_as_array(raw_column_names)
    data["submitted_answers"][file_name + "_column_names"] = {}
    for wanted_name in column_names:
        pl_html_name = get_column_key(wanted_name, answer_name)
        user_supplied_name = data["submitted_answers"][pl_html_name] or wanted_name
        data["submitted_answers"][file_name + "_column_names"][wanted_name] = user_supplied_name
        del data["submitted_answers"][pl_html_name]
