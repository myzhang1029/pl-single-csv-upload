import base64
import csv
import hashlib
import json
from io import StringIO

import chevron
import lxml.html
import prairielearn as pl
from colors import PLColor


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
# column_names attribute
def get_answer_name(column_names: str) -> str:
    return "_single_csv_upload_{0}".format(
        hashlib.sha1(column_names.encode("utf-8")).hexdigest()
    )


def add_format_error(data: pl.QuestionData, error_string: str) -> None:
    pl.add_files_format_error(data, error_string)


def prepare(element_html: str, data: pl.QuestionData) -> None:
    element = lxml.html.fragment_fromstring(element_html)
    required_attribs = ["column-names"]
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

    raw_column_names = pl.get_string_attrib(element, "column-names", "")
    column_names = sorted(get_clist_as_array(raw_column_names))
    column_names_json = json.dumps(column_names, allow_nan=False)

    answer_name = get_answer_name(raw_column_names)

    html_params = {
        "name": answer_name,
        "column_names": column_names_json,
        "uuid": uuid,
        "editable": data["editable"],
    }

    with open("pl-single-csv-upload.mustache", "r", encoding="utf-8") as f:
        return chevron.render(f, html_params).strip()


def parse(element_html: str, data: pl.QuestionData) -> None:
    element = lxml.html.fragment_fromstring(element_html)
    raw_column_names = pl.get_string_attrib(element, "column-names", "")
    answer_name = get_answer_name(raw_column_names)

    # Get submitted answer or return parse_error if it does not exist
    file_content = data["submitted_answers"].get(answer_name, None)
    if not file_content:
        add_format_error(data, "No submitted answer for single CSV upload.")
        return

    # We will store the files in the submitted_answer["_files"] key,
    # so delete the original submitted answer format to avoid
    # duplication
    del data["submitted_answers"][answer_name]

    try:
        parsed_b64_payload = json.loads(file_content)
    except Exception:
        add_format_error(data, "Could not parse submitted files.")
        parsed_b64_payload = None

    pl.add_submitted_file(data, pl.get_uuid() + ".csv", parsed_b64_payload)

    # Convert the column names to a dictionary for easy access
    column_names = get_clist_as_array(raw_column_names)
    data["submitted_answers"]["column_names"] = {}
    for wanted_name in column_names:
        # Generated in `pl-single-csv-upload.js::renderColList`
        base64_colname = base64.b64encode(wanted_name.encode("utf-8")).decode("utf-8")
        pl_html_name = f"single_csv_upload_col_{answer_name}_{base64_colname}"
        user_supplied_name = data["submitted_answers"][pl_html_name]
        data["submitted_answers"]["column_names"][wanted_name] = user_supplied_name
        del data["submitted_answers"][pl_html_name]

    # Test-parse the CSV file to check for missing columns
    if parsed_b64_payload is not None:
        user_specified_colnames = set(data["submitted_answers"]["column_names"].values())
        if len(user_specified_colnames) != len(column_names):
            add_format_error(
                data,
                "Some columns have duplicate names. Please ensure that each column has a unique name.",
            )
            return
        contents = base64.b64decode(parsed_b64_payload).decode("utf-8")
        reader = csv.reader(
            StringIO(contents),
            delimiter=",",
            escapechar="\\",
            quoting=csv.QUOTE_NONE,
            skipinitialspace=True,
            strict=True,
        )
        header = next(reader)
        missing_columns = set(column_names) - set(header)
        if len(missing_columns) > 0:
            add_format_error(
                data,
                "The following columns are missing from the uploaded CSV file: "
                + ", ".join(missing_columns),
            )
