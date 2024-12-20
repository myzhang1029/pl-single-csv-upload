import base64
import csv
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


# Generate a unique key for each column name
def get_column_key(column_name: str, file_name: str) -> str:
    encoded = base64.b16encode(column_name.encode("utf-8")).decode("utf-8")
    encoded_file_name = base64.b16encode(file_name.encode("utf-8")).decode("utf-8")
    return f"_single_csv_upload_{encoded_file_name}_col_{encoded}"


def prepare(element_html: str, data: pl.QuestionData) -> None:
    element = lxml.html.fragment_fromstring(element_html)
    required_attribs = ["column-names", "file-name"]
    optional_attribs = []
    pl.check_attribs(element, required_attribs, optional_attribs)


def render(element_html: str, data: pl.QuestionData) -> str:
    if data["panel"] != "question":
        return ""

    element = lxml.html.fragment_fromstring(element_html)
    uuid = pl.get_uuid()

    raw_column_names = pl.get_string_attrib(element, "column-names")
    file_name = pl.get_string_attrib(element, "file-name")
    column_names = get_clist_as_array(raw_column_names)
    column_names_json = json.dumps(column_names, allow_nan=False)
    column_names_rich = [{"col_text": name, "col_key": get_column_key(name, file_name)} for name in column_names]
    # This is for restoring the user's original submission during editing
    old_submission = data["submitted_answers"].get(file_name, None)
    old_submission_content = old_submission.get("content", None) if old_submission else None
    # A dictionary of column names to user-supplied names
    old_column_assignments = old_submission.get("column_names", {}) if old_submission else {}
    # Transform it to {col-key: user-supplied-name}
    old_column_assignments = {get_column_key(k, file_name): v for k, v in old_column_assignments.items()}
    old_column_assignments_json = json.dumps(old_column_assignments, allow_nan=False)

    html_params = {
        "file_name": file_name,
        "column_names": column_names_rich,
        "column_names_json": column_names_json,
        "old_submission": old_submission_content,
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

    # Get submitted answer or return parse_error if it does not exist
    # The HTML/JS interface has no distinction between empty and non-existent
    # submissions, so we do not distinguish between them here either
    file_content = data["submitted_answers"].get(file_name, "")
    # Move the file content to a user-friendly key
    del data["submitted_answers"][file_name]
    data["submitted_answers"][file_name] = {}
    if not file_content:
        pl.add_files_format_error(data, "No submitted answer for single CSV upload")
        # So if `data["submitted_answers"][file_name] == {}`, the question author can
        # be sure that we processed everything correctly but there was no submission
        # or the submission was empty
        return
    data["submitted_answers"][file_name]["content"] = file_content
    data["submitted_answers"][file_name]["column_names"] = {}

    # Convert the column names to a dictionary for easy access
    wanted_names = get_clist_as_array(raw_column_names)
    for wanted_name in wanted_names:
        pl_html_name = get_column_key(wanted_name, file_name)
        if pl_html_name not in data["submitted_answers"]:
            pl.add_files_format_error(data, f"Column not selected for {wanted_name}")
            continue
        user_supplied_name = data["submitted_answers"][pl_html_name]
        data["submitted_answers"][file_name]["column_names"][wanted_name] = user_supplied_name
        del data["submitted_answers"][pl_html_name]
