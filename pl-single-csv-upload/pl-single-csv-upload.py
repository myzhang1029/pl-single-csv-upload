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
    required_column_names = get_clist_as_array(raw_column_names)
    answer_name = get_answer_name(raw_column_names)
    raise Exception(f"answers: {data['submitted_answers'].keys()}")

    # Get submitted answer or return parse_error if it does not exist
    files = data["submitted_answers"].get(answer_name, None)
    if not files:
        add_format_error(data, "No submitted answer for single CSV upload.")
        return

    # We will store the files in the submitted_answer["_files"] key,
    # so delete the original submitted answer format to avoid
    # duplication
    del data["submitted_answers"][answer_name]

    try:
        parsed_files = json.loads(files)
    except Exception:
        add_format_error(data, "Could not parse submitted files.")
        parsed_files = []

    for x in parsed_files:
        # Filter out any files that were not listed in file_names
        if x.get("name", "") in required_column_names:
            pl.add_submitted_file(data, x.get("name", ""), x.get("contents", ""))

    # Validate that all required files are present
    if parsed_files is not None:
        submitted_file_names = [x.get("name", "") for x in parsed_files]
        missing_files = [
            x for x in required_file_names if x not in submitted_file_names
        ]

        if len(missing_files) > 0:
            add_format_error(
                data,
                "The following required files were missing: "
                + ", ".join(missing_files),
            )
