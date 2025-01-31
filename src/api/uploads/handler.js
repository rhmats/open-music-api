class UploadsHandler {
  constructor(service, albumsService, validator) {
    this._service = service;
    this._albumsService = albumsService;
    this._validator = validator;

    this.postUploadCoverImageHandler =
      this.postUploadCoverImageHandler.bind(this);
  }

  async postUploadCoverImageHandler(request, h) {
    const { id: albumId } = request.params;
    const { cover } = request.payload;

    if (!cover) {
      const response = h.response({
        status: 'fail',
        message: 'Gambar harus diupload',
      });
      response.code(400);
      return response;
    }
    this._validator.validateImageHeaders(cover.hapi.headers);

    const filename = await this._service.writeFile(cover, cover.hapi);

    const coverUrl = `http://${process.env.HOST}:${process.env.PORT}/upload/images/${filename}`;
    await this._albumsService.updateCoverAlbumById(albumId, coverUrl);

    const response = h.response({
      status: 'success',
      message: 'Sampul berhasil diunggah',
      data: {
        fileLocation: `http://${process.env.HOST}:${process.env.PORT}/upload/images/${filename}`,
      },
    });
    response.code(201);
    return response;
  }
}

module.exports = UploadsHandler;
