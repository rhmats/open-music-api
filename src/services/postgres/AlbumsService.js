const { nanoid } = require('nanoid');
const { Pool } = require('pg');
const InvariantError = require('../../exceptions/InvariantError');
const { mapAlbumsToModel, mapSongsToModel } = require('../../utils/index');
const NotFoundError = require('../../exceptions/NotFoundError');

class AlbumsService {
  constructor(cacheService) {
    this._pool = new Pool();
    this._cacheService = cacheService;

  }

  async addAlbum({ name, year }) {
    const id = nanoid(16);
    const createdAt = new Date().toISOString();

    const query = {
      text: 'INSERT INTO albums VALUES($1, $2, $3, $4, $4) RETURNING id',
      values: [id, name, year, createdAt],
    };

    const result = await this._pool.query(query);

    if (!result.rows[0].id) {
      throw new InvariantError('Album gagal ditambahkan');
    }

    return result.rows[0].id;
  }

  async getAlbums() {
    const result = await this._pool.query('SELECT * FROM albums');
    return result.rows.map(mapAlbumsToModel);
  }

  async getAlbumById(id) {
    const albumQuery = {
      text: 'SELECT * FROM albums WHERE id = $1',
      values: [id],
    };
    const albumResult = await this._pool.query(albumQuery);

    if (!albumResult.rows.length) {
      throw new NotFoundError('Album tidak ditemukan');
    }

    const album = albumResult.rows.map(mapAlbumsToModel)[0];

    const songsQuery = {
      text: 'SELECT id, title, performer FROM songs WHERE album_id = $1',
      values: [album.id],
    };
    const songsResult = await this._pool.query(songsQuery);

    const songs = songsResult.rows.map(mapSongsToModel);

    const response = {
      ...album,
      songs,
    };
    return response;
  }

  async editAlbumById(id, { name, year }) {
    const updatedAt = new Date().toISOString();
    const query = {
      text: 'UPDATE albums SET name = $1, year = $2, updated_at = $3 WHERE id = $4 RETURNING id',
      values: [name, year, updatedAt, id],
    };

    const result = await this._pool.query(query);

    if (!result.rows.length) {
      throw new NotFoundError('Gagal memperbarui Album. Id tidak ditemukan');
    }
  }

  async deleteAlbumById(id) {
    const query = {
      text: 'DELETE FROM albums WHERE id = $1 RETURNING id',
      values: [id],
    };

    const result = await this._pool.query(query);
    if (!result.rows.length) {
      throw new NotFoundError('Album gagal dihapus. Id tidak ditemukan');
    }
  }

  async updateCoverAlbumById(albumId, coverUrl) {
    const query = {
      text: 'UPDATE albums SET "coverUrl" = $1 WHERE id = $2',
      values: [coverUrl, albumId],
    };
    const result = await this._pool.query(query);
    if (!result.rowCount) {
      throw new NotFoundError(
        'Cover Album gagal diperbarui. Id tidak ditemukan'
      );
    }
  }

  async validateLikeAlbum(userId, albumId) {
    const query = {
      text: 'SELECT * FROM user_album_likes WHERE user_id = $1 AND album_id = $2',
      values: [userId, albumId],
    };
    const result = await this._pool.query(query);
    if (!result.rows.length) {
      return false;
    }
    return true;
  }

  async addAlbumLikes(userId, albumId) {
    const id = nanoid(16);

    const query = {
      text: 'INSERT INTO user_album_likes VALUES($1, $2, $3) RETURNING id',
      values: [id, userId, albumId],
    };

    const result = await this._pool.query(query);

    if (!result.rows[0].id) {
      throw new InvariantError('Album Like gagal ditambahkan');
    }
    await this._cacheService.delete(`likes:${albumId}`);
    return result.rows[0].id;
  }

  async getAlbumLikes(id) {
    try {
      const customHeader = 'cache';
      const likes = await this._cacheService.get(`likes:${id}`);
      return { customHeader, likes: +likes };
    } catch {
      await this.getAlbumById(id);

      const customHeader = 'server';
      const query = {
        text: 'SELECT * FROM user_album_likes WHERE album_id = $1',
        values: [id],
      };

      const result = await this._pool.query(query);
      const likes = result.rowCount;
      await this._cacheService.set(`likes:${id}`, likes);
      return { customHeader, likes };
    }
  }

  async deleteAlbumLike(id, userId) {
    await this.getAlbumById(id);
    const query = {
      text: 'DELETE FROM user_album_likes WHERE user_id = $1 AND album_id = $2 RETURNING id',
      values: [userId, id],
    };
    const result = await this._pool.query(query);
    if (!result.rows.length) {
      throw new NotFoundError('Id tidak ditemukan');
    }
    await this._cacheService.delete(`likes:${id}`);
  }
}

module.exports = AlbumsService;
