require('dotenv').config();

const Hapi = require('@hapi/hapi');
const ClientError = require('./exceptions/ClientError');
const Jwt = require('@hapi/jwt');
const Inert = require('@hapi/inert');
const path = require('path');

// Albums
const albums = require('./api/albums');
const AlbumsValidator = require('./validator/albums');
const AlbumsService = require('./services/postgres/AlbumsService');

// Songs
const songs = require('./api/songs');
const SongsValidator = require('./validator/songs');
const SongsService = require('./services/postgres/SongsService');

// users
const users = require('./api/users');
const UsersService = require('./services/postgres/UsersService');
const UsersValidator = require('./validator/users');

// authentications
const authentications = require('./api/authentications');
const AuthenticationsService = require('./services/postgres/AuthenticationService');
const TokenManager = require('./tokenize/TokenManager');
const AuthenticationsValidator = require('./validator/authentications');

// playlists
const playlists = require('./api/playlists');
const PlaylistsService = require('./services/postgres/PlaylistsService');
const PlaylistsValidator = require('./validator/playlists');

// collaborations
const collaborations = require('./api/collaborations');
const CollaborationsService = require('./services/postgres/CollaborationsService');
const CollaborationsValidator = require('./validator/collaborations');

// playlistsSongs
const playlistSong = require('./api/playlistsSong');
const PlaylistSongsService = require('./services/postgres/PlaylistSongsService');
const PlaylistsSongValidator = require('./validator/playlistSong');

// playlist activities
const playlistSongsActivities = require('./api/playlistSongsActivities');
const PlaylistSongsActivitiesService = require('./services/postgres/PlaylistSongsActivitiesService');
const PlaylistSongsActivitiesValidator = require('./validator/playlistSongsActivities');

// Exports
const _exports = require('./api/exports');
const ProducerService = require('./services/rabbitmq/ProducerService');
const ExportsValidator = require('./validator/exports');

// uploads
const uploads = require('./api/uploads');
const StorageService = require('./services/storage/StorageService');
const UploadsValidator = require('./validator/uploads');

// cache
const CacheService = require('./services/redis/CacheService');

const init = async () => {
  const cacheService = new CacheService();
  const albumsService = new AlbumsService(cacheService);
  const songsService = new SongsService();
  const usersService = new UsersService();
  const authenticationsService = new AuthenticationsService();
  const collaborationsService = new CollaborationsService(cacheService);
  const playlistsService = new PlaylistsService(collaborationsService);
  const playlistSongsService = new PlaylistSongsService(collaborationsService);
  const playlistSongsActivitiesService = new PlaylistSongsActivitiesService();
  const storageService = new StorageService(
    path.resolve(__dirname, 'api/uploads/file/images')
  );

  const server = Hapi.server({
    port: process.env.PORT,
    host: process.env.HOST,
    debug: {
      request: ['error'],
    },
    routes: {
      cors: {
        origin: ['*'],
      },
    },
  });

  await server.register([
    {
      plugin: Jwt,
    },
    {
      plugin: Inert,
    },
  ]);

  // mendefinisikan strategy autentikasi jwt
  server.auth.strategy('songsapp_jwt', 'jwt', {
    keys: process.env.ACCESS_TOKEN_KEY,
    verify: {
      aud: false,
      iss: false,
      sub: false,
      maxAgeSec: process.env.ACCESS_TOKEN_AGE,
    },
    validate: (artifacts) => ({
      isValid: true,
      credentials: {
        id: artifacts.decoded.payload.id,
      },
    }),
  });

  await server.register([
    {
      plugin: albums,
      options: {
        service: albumsService,
        validator: AlbumsValidator,
      },
    },
    {
      plugin: songs,
      options: {
        service: songsService,
        validator: SongsValidator,
      },
    },
    {
      plugin: users,
      options: {
        service: usersService,
        validator: UsersValidator,
      },
    },
    {
      plugin: authentications,
      options: {
        authenticationsService,
        usersService,
        tokenManager: TokenManager,
        validator: AuthenticationsValidator,
      },
    },
    {
      plugin: playlists,
      options: {
        service: playlistsService,
        validator: PlaylistsValidator,
      },
    },
    {
      plugin: collaborations,
      options: {
        collaborationsService,
        playlistsService,
        usersService,
        validator: CollaborationsValidator,
      },
    },
    {
      plugin: playlistSong,
      options: {
        playlistsService,
        songsService,
        playlistSongsService,
        collaborationsService,
        validator: PlaylistsSongValidator,
      },
    },
    {
      plugin: playlistSongsActivities,
      options: {
        playlistsService,
        playlistSongsActivitiesService,
        validator: PlaylistSongsActivitiesValidator,
      },
    },
    {
      plugin: _exports,
      options: {
        ProducerService,
        playlistsService,
        validator: ExportsValidator,
      },
    },
    {
      plugin: uploads,
      options: {
        service: storageService,
        albumsService,
        validator: UploadsValidator,
      },
    },
  ]);

  await server.ext('onPreResponse', (request, h) => {
    const { response } = request;

    if (response instanceof ClientError) {
      console.log(response);
      return h
        .response({
          status: 'fail',
          message: response.message,
        })
        .code(response.statusCode);
    }

    if (response instanceof Error) {
      const { statusCode, payload } = response.output;

      switch (statusCode) {
      case 401:
        return h.response(payload).code(401);
      case 404:
        return h.response(payload).code(404);
      case 413: // Tangani error 413 secara eksplisit
        return h
          .response({
            status: 'fail',
            message: 'Ukuran file terlalu besar, maksimal 512 KB',
          })
          .code(413);
      default:
        console.log(response);
        return h
          .response({
            status: 'error',
            error: payload.error,
            message: payload.message,
          })
          .code(500);
      }
    }

    return response.continue || response;
  });

  await server.start();
  console.log(`Server berjalan pada ${server.info.uri}`);
};

init();
