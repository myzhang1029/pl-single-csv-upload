/* eslint-env browser,jquery */

(() => {
  class PLSingleCsvUpload {
    constructor(uuid, options) {
      this.uuid = uuid;
      this.file = null;
      this.requiredColumns = options.requiredColumns || [];

      const elementId = '#csv-upload-' + uuid;
      this.element = $(elementId);
      if (!this.element) {
        throw new Error('CSV upload element ' + elementId + ' was not found!');
      }

      this.checkIconColor = options.checkIconColor;

      // We need to render after we start loading the existing files so that we
      // can pick up the right values from `pendingFileDownloads`.
      this.initializeTemplate();
    }

    /**
     * Initializes the file upload zone on the question.
     */
    initializeTemplate() {
      const $dropTarget = this.element.find('.upload-dropzone');

      $dropTarget.dropzone({
        url: '/none',
        autoProcessQueue: false,
        accept: (_file, done) => {
          return done();
        },
        addedfile: (file) => {
          this.addFileFromBlob(file, false);
        },
      });

      this.renderColList();
    }

    /**
     * Syncs the internal file array to the hidden input element
     * @type {[type]}
     */
    syncFilesToHiddenInput() {
      this.element.find('input').val(JSON.stringify(this.file));
    }

    addFileFromBlob(blob, isFromDownload) {
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
        this.renderColList();

        if (!isFromDownload) {
          // Ensure that students see a prompt if they try to navigate away
          // from the page without saving the form. This check is initially
          // disabled because we don't want students to see the prompt if they
          // haven't actually made any changes.
          this.element.find('input').removeAttr('data-disable-unload-check');
        }
      };

      reader.readAsDataURL(blob);
    }

    /**
     * Generates markup to show the status of required columns
     */
    renderColList() {
      var $downloadArea = this.element.find('#single-csv-upload-download-link-area-' + this.uuid);
      if (this.file) {
        var download =
          '<a download="student-uploaded.csv" class="btn btn-outline-secondary btn-sm mr-1" href="data:application/octet-stream;base64,' +
          this.file +
          '">Download</a>';
        $downloadArea.append(
          '<div class="align-self-center">' +
            download +
            `<button type="button" class="btn btn-outline-secondary btn-sm file-preview-button data-toggle="collapse" data-target="#file-preview-${uuid}-" aria-controls="file-preview-${uuid}">` +
            '<span class="file-preview-icon fa fa-angle-down"></span>' +
            '</button>' +
            '</div>',
        );
      }

      var $colList = this.element.find('.single-csv-upload-status .card ul.list-group');

      $colList.html('');

      var uuid = this.uuid;
      this.requiredColumns.forEach((colName) => {
        // Placeholder for the column status
        var $col = $('<li class="list-group-item"></li>');
        $col.append('<span class="col-name">' + colName + '</span>');
        $col.append('<span class="col-status"></span>');
        $colList.append($col);
      });
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
