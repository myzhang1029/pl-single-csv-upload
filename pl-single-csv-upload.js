/* eslint-env browser,jquery */

(() => {
  class PLSingleCsvUpload {
    constructor(uuid, options) {
      this.uuid = uuid;
      this.file = null;
      this.requiredColumns = options.requiredColumns;
      this.answerName = options.answerName;
      this.fileName = options.fileName;

      const elementId = '#single-csv-upload-' + uuid;
      this.element = $(elementId);
      if (!this.element) {
        throw new Error('CSV upload element ' + elementId + ' was not found!');
      }

      const $dropTarget = this.element.find('.upload-dropzone');

      $dropTarget.dropzone({
        url: '/none',
        autoProcessQueue: false,
        accept: (_file, done) => {
          return done();
        },
        addedfile: (file) => {
          this.addFileFromBlob(file);
        },
        acceptedFiles: 'text/csv,text/plain,.csv',
        maxFiles: 1,
      });

      if (options.oldSubmission && options.oldSubmission.length > 0 && options.oldColumnAssignments) {
        this.fillOldSubmissionContent(options.oldSubmission, options.oldColumnAssignments);
      }
      this.renderDownloadButton();
    }

    /**
     * Syncs the internal file array to the hidden input element
     * @type {[type]}
     */
    syncFilesToHiddenInput() {
      this.element.find('input.single-csv-upload-data').val(this.file);
    }

    fillOldSubmissionContent(oldSubmission, oldColumnAssignments) {
      this.file = oldSubmission;
      this.syncFilesToHiddenInput();
      this.renderColumnTable();
      // Make sure to do this after renderColumnTable, or
      // all the select elements will be removed
      for (var key in oldColumnAssignments) {
        this.element.find('#' + key + '-select').val(oldColumnAssignments[key]);
      }
    }

    addFileFromBlob(blob) {
      var reader = new FileReader();
      reader.onload = (e) => {
        var dataUrl = e.target.result;

        var commaSplitIdx = dataUrl.indexOf(',');
        if (commaSplitIdx === -1) {
          this.addWarningMessage('<strong>' + blob.name + '</strong>' + ' is empty, ignoring file.');
          return;
        }

        // Store the file as base-64 encoded data
        var base64FileData = dataUrl.substring(commaSplitIdx + 1);
        this.file = base64FileData;
        this.syncFilesToHiddenInput();
        this.renderDownloadButton();
        this.renderColumnTable();

        // Ensure that students see a prompt if they try to navigate away
        // from the page without saving the form. This check is initially
        // disabled because we don't want students to see the prompt if they
        // haven't actually made any changes.
        this.element.find('input.single-csv-upload-data').removeAttr('data-disable-unload-check');
      };

      reader.readAsDataURL(blob);
    }

    renderDownloadButton() {
      if (this.file) {
        var $downloadArea = this.element.find('#single-csv-upload-download-link-area-' + this.uuid);
        var download =
          '<a download="' +
          this.fileName +
          '" class="btn btn-outline-secondary btn-sm mr-1" href="data:application/octet-stream;base64,' +
          this.file +
          '">Download</a>';
        $downloadArea.html(download);
      }
    }

    renderColumnTable() {
      if (this.file) {
        var rawcontent = atob(this.file);
        var parsed = csv_parse_sync.parse(rawcontent, {
            // e.g. Capstone always makes BOMful CSVs, so we leave this on
            bom: true,
            // We want to get the header row directly, so don't parse them for us
            columns: false,
            // Keep only the first row
            to: 1
        });
        // The first record should be the header row
        var header_col_names = parsed[0];
        var $col_selects = this.element.find('.single-csv-upload-select-group select');
        $col_selects.empty();
        for (var i = 0; i < header_col_names.length; i++) {
          var $option = $('<option></option>');
          $option.attr('value', header_col_names[i]);
          $option.text(header_col_names[i]);
          $col_selects.append($option);
        }
      }
    }

    addWarningMessage(message) {
      var $alert = $(
        '<div class="alert alert-warning alert-dismissible" role="alert"><button type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button></div>',
      );
      $alert.append(message);
      this.element.find('.messages').append($alert);
    }
  }

  window.PLSingleCsvUpload = PLSingleCsvUpload;
})();
