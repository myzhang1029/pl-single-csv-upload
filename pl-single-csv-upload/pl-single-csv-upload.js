/* eslint-env browser,jquery */

(() => {
  function escapePath(path) {
    return path
      .replace(/^\//, '')
      .split('/')
      .map((part) => encodeURIComponent(part))
      .join('/');
  }

  class PLSingleCsvUpload {
    constructor(uuid, options) {
      this.uuid = uuid;
      this.files = [];
      this.acceptedFiles = options.acceptedFiles || [];
      this.acceptedFilesLowerCase = this.acceptedFiles.map((f) => f.toLowerCase());
      this.pendingFileDownloads = new Set();
      this.failedFileDownloads = new Set();

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
        accept: (file, done) => {
          // fuzzy case match
          const fileNameLowerCase = file.name.toLowerCase();
          if (this.acceptedFilesLowerCase.includes(fileNameLowerCase)) {
            return done();
          }
          return done('invalid file');
        },
        addedfile: (file) => {
          // fuzzy case match
          const fileNameLowerCase = file.name.toLowerCase();
          if (!this.acceptedFilesLowerCase.includes(fileNameLowerCase)) {
            this.addWarningMessage(
              '<strong>' +
                file.name +
                '</strong>' +
                ' did not match any accepted file for this question.',
            );
            return;
          }
          const acceptedFilesIdx = this.acceptedFilesLowerCase.indexOf(fileNameLowerCase);
          const acceptedName = this.acceptedFiles[acceptedFilesIdx];
          this.addFileFromBlob(acceptedName, file, false);
        },
      });

      this.renderColList();
    }

    /**
     * Syncs the internal file array to the hidden input element
     * @type {[type]}
     */
    syncFilesToHiddenInput() {
      this.element.find('input').val(JSON.stringify(this.files));
    }

    addFileFromBlob(name, blob, isFromDownload) {
      this.pendingFileDownloads.delete(name);
      this.failedFileDownloads.delete(name);

      var reader = new FileReader();
      reader.onload = (e) => {
        var dataUrl = e.target.result;

        var commaSplitIdx = dataUrl.indexOf(',');
        if (commaSplitIdx === -1) {
          this.addWarningMessage('<strong>' + name + '</strong>' + ' is empty, ignoring file.');
          return;
        }

        // Store the file as base-64 encoded data
        var base64FileData = dataUrl.substring(commaSplitIdx + 1);
        this.saveSubmittedFile(name, base64FileData);
        this.renderColList();

        if (!isFromDownload) {
          // Show the preview for the newly-uploaded file
          const container = this.element.find(`li[data-file="${name}"]`);
          container.find('.file-preview').addClass('show');
          container.find('.file-preview-button').removeClass('collapsed');

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
     * Saves or updates the given file.
     * @param  {String} name     Name of the file
     * @param  {String} contents The file's base64-encoded contents
     */
    saveSubmittedFile(name, contents) {
      var idx = this.files.findIndex((file) => file.name === name);
      if (idx === -1) {
        this.files.push({
          name,
          contents,
        });
      } else {
        this.files[idx].contents = contents;
      }

      this.syncFilesToHiddenInput();
    }

    /**
     * Gets the base64-encoded contents of a file with the given name.
     * @param  {String} name The desired file
     * @return {String}      The file's contents, or null if the file was not found
     */
    getSubmittedFileContents(name) {
      const file = this.files.find((file) => file.name === name);
      return file ? file.contents : null;
    }

    /**
     * Generates markup to show the status of required columns
     */
    renderColList() {
      var $colList = this.element.find('.single-csv-upload-status .card ul.list-group');

      $colList.html('');

      var uuid = this.uuid;

      this.acceptedFiles.forEach((fileName, index) => {
        var fileData = this.getSubmittedFileContents(fileName);

        var $file = $('<li class="list-group-item" data-file="' + fileName + '"></li>');
        var $fileStatusContainer = $('<div class="file-status-container d-flex flex-row"></div>');
        $file.append($fileStatusContainer);
        var $fileStatusContainerLeft = $('<div class="flex-grow-1"></div>');
        $fileStatusContainer.append($fileStatusContainerLeft);
        if (this.pendingFileDownloads.has(fileName)) {
          $fileStatusContainerLeft.append(
            '<i class="file-status-icon fas fa-spinner fa-spin" aria-hidden="true"></i>',
          );
        } else if (this.failedFileDownloads.has(fileName)) {
          $fileStatusContainerLeft.append(
            '<i class="file-status-icon fas fa-circle-exclamation text-danger" aria-hidden="true"></i>',
          );
        } else if (fileData) {
          $fileStatusContainerLeft.append(
            `<i class="file-status-icon fa fa-check-circle" style="color: ${this.checkIconColor}" aria-hidden="true"></i>`,
          );
        } else {
          $fileStatusContainerLeft.append(
            '<i class="file-status-icon far fa-circle" aria-hidden="true"></i>',
          );
        }
        $fileStatusContainerLeft.append(fileName);
        if (this.pendingFileDownloads.has(fileName)) {
          $fileStatusContainerLeft.append(
            '<p class="file-status">fetching previous submission...</p>',
          );
        } else if (this.failedFileDownloads.has(fileName)) {
          $fileStatusContainerLeft.append(
            '<p class="file-status">failed to fetch previous submission; upload this file again</p>',
          );
        } else if (!fileData) {
          $fileStatusContainerLeft.append('<p class="file-status">not uploaded</p>');
        } else {
          $fileStatusContainerLeft.append('<p class="file-status">uploaded</p>');
        }
        if (fileData) {
          var download =
            '<a download="' +
            fileName +
            '" class="btn btn-outline-secondary btn-sm mr-1" href="data:application/octet-stream;base64,' +
            fileData +
            '">Download</a>';

          $fileStatusContainer.append(
            '<div class="align-self-center">' +
              download +
              `<button type="button" class="btn btn-outline-secondary btn-sm file-preview-button ${!isExpanded ? 'collapsed' : ''}" data-toggle="collapse" data-target="#file-preview-${uuid}-${index}" aria-expanded="${isExpanded ? 'true' : 'false'}" aria-controls="file-preview-${uuid}-${index}">` +
              '<span class="file-preview-icon fa fa-angle-down"></span>' +
              '</button>' +
              '</div>',
          );
        }

        $colList.append($file);
      });
    }

    addWarningMessage(message) {
      var $alert = $(
        '<div class="alert alert-warning alert-dismissible" role="alert"><button type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button></div>',
      );
      $alert.append(message);
      this.element.find('.messages').append($alert);
    }

    /**
     * Checks if the given file contents should be treated as binary or
     * text. Uses the same method as git: if the file contains a
     * NUL character ('\0'), we consider the file to be binary.
     * http://stackoverflow.com/questions/6119956/how-to-determine-if-git-handles-a-file-as-binary-or-as-text
     * @param  {String}  decodedFileContents File contents to check
     * @return {Boolean}                     If the file is recognized as binary
     */
    isBinary(decodedFileContents) {
      // Maiyun: the original code makes no sense. git skips after 8000 bytes
      // because it's a performance optimization to not read the entire file.
      // But we're already reading the entire file, so we can just check for
      // the presence of a NUL character anywhere in the file.
      var nulIdx = decodedFileContents.indexOf('\0');
      return nulIdx !== -1;
    }

    /**
     * To support unicode strings, we use a method from Mozilla to decode:
     * first we get the bytestream, then we percent-encode it, then we
     * decode that to the original string.
     * https://developer.mozilla.org/en-US/docs/Web/API/WindowBase64/Base64_encoding_and_decoding#The_Unicode_Problem
     * @param  {String} str the base64 string to decode
     * @return {String}     the decoded string
     */
    b64DecodeUnicode(str) {
      // Going backwards: from bytestream, to percent-encoding, to original string.
      return decodeURIComponent(
        atob(str)
          .split('')
          .map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          })
          .join(''),
      );
    }

    b64ToBlobUrl(str, options = undefined) {
      const blob = new Blob(
        [
          new Uint8Array(
            atob(str)
              .split('')
              .map((c) => c.charCodeAt(0)),
          ),
        ],
        options,
      );
      return URL.createObjectURL(blob);
    }
  }

  window.PLSingleCsvUpload = PLSingleCsvUpload;
})();
