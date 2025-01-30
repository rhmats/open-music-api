/* eslint-disable camelcase */
const mapAlbumsToModel = ({ id, name, year, coverUrl }) => ({
  id,
  name,
  year,
  coverUrl,
});

const mapSongsToModel = ({
  id,
  title,
  year,
  genre,
  performer,
  duration,
  album_id,
  created_at,
  updated_at,
}) => ({
  id,
  title,
  year,
  genre,
  performer,
  duration,
  albumId: album_id,
  createdAt: created_at,
  updatedAt: updated_at,
});

module.exports = { mapAlbumsToModel, mapSongsToModel };
