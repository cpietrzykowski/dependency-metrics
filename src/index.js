import fs from 'fs';
import path from 'path';
import NpmClient from 'npm-registry-client';
import moment from 'moment';
import dotenv from 'dotenv';
import octokit from '@octokit/rest';

dotenv.config();

/**
 * @return {NpmClient}
 */
function createNpmRegistryApiClient() {
  const config = {};
  const client = new NpmClient(config);
  const baseuri = 'https://registry.npmjs.org/';
  const params = { 'timeout': 1000 };

  return function(name) {
    // encode scoped package name
    const pkg = name.replace(/@(.*)/, function(_, $1) {
      return `@${encodeURIComponent($1)}`;
    });

    return new Promise(function(resolve, reject) {
      // fetch npm registry data
      client.get(`${baseuri}${pkg}`, params, function(err, data, raw, res) {
        if (err) return reject(err);
        return resolve(data);
      });
    });
  };
}

const npmRegistryClient = createNpmRegistryApiClient();

/**
 * @param {string} pkg
 * @param {string} version
 * @return {object}
 */
function fetchNpmPackageVitals(pkg, version) {
  return npmRegistryClient(pkg).then(function(data) {
    const name = data['name'];
    const latest = data['dist-tags']['latest'];
    const latestReleaseDate = moment(data['time'][latest]);
    const latestRepoUrl = data['versions'][latest]['repository']['url'];

    // now fetch repo meta if possible
    return {
      name,
      'latest': {
        'version': latest,
        'release': latestReleaseDate,
        'repo': latestRepoUrl,
      },
    };
  });
}

/**
 * @param {string} accessToken
 * @return {octokit}
 */
function createGithubApiClient(accessToken) {
  const client = octokit();
  if (accessToken) {
    client.authenticate({
      'type': 'token',
      'token': accessToken,
    });
  }

  return client;
}

const githubApiClient = createGithubApiClient(process.env.GITHUB_ACCESSTOKEN);

/**
 *
 * @param {string} owner
 * @param {string} repo
 * @return {Promise}
 */
function fetchGithubRepositoryVitals(owner, repo) {
  return githubApiClient.repos.get({ owner, repo }).then(function(response) {
    const { data } = response;
    // const defaultBranch = data['default_branch'];
    const createdAt = moment(data['created_at']);
    const updatedAt = moment(data['updated_at']);

    return {
      'name': data.full_name,
      'created': createdAt,
      'updated': updatedAt,
      'stars': data['stargazers_count'],
    };
  });
}

/**
 *
 * @param {Object} dependencies object keyed by dependency category
 * @return {Promise}
 */
function fetchDependencyVitals(dependencies) {
  const tasks = [];
  const npmmemo = {}; // npm registry: {pkg: vitals}
  const ghmemo = {}; // github: {repo: vitals}

  const meta = Object.keys(dependencies).map(function(category) {
    return {
      category,
      'packages': Object.keys(dependencies[category]).map(function(pkg) {
        const vitals = { 'package': pkg };
        const version = dependencies[category][pkg];

        // the jury is still out on the cleverness or smell of this pattern
        // - this should be refactored for source readability
        //
        // queue up network tasks capturing 'vitals' to modify
        tasks.push(
          new Promise(function(resolve, reject) {
            if (pkg in npmmemo) {
              return resolve(npmmemo[pkg]);
            }

            return fetchNpmPackageVitals(pkg, version).then(function(meta) {
              npmmemo[pkg] = meta;
              return resolve(meta);
            });
          }).then(function(npmmeta) {
            vitals['name'] = npmmeta['name']; // should be identical to 'pkg'
            vitals['version'] = `${npmmeta['latest']['version']} (${version})`;
            const npmrelease = npmmeta['latest']['release'];
            vitals[
              'updated'
            ] = `Updated: ${npmrelease.fromNow()} (${npmrelease})`;
            const repo = npmmeta['latest']['repo'];
            const matches = repo.match(/.*github.com\/(.*)\.git/);

            // github network step
            if (matches) {
              return new Promise(function(resolve, reject) {
                const repoid = matches[1]; // owner/repo
                if (repoid in ghmemo) {
                  return resolve(ghmemo[repoid]);
                }

                const [owner, repo] = repoid.split('/');
                return fetchGithubRepositoryVitals(owner, repo).then(function(
                  meta
                ) {
                  ghmemo[repoid] = meta;
                  return resolve(meta);
                });
              }).then(function(meta) {
                vitals['github'] = {
                  repo,
                  'name': meta['name'],
                  'stars': meta['stars'],
                  'age': `${meta['created'].from(meta['updated'], true)}`,
                  'updated': `Updated: ${meta['updated'].fromNow()} (${
                    meta['updated']
                  })`,
                };

                return vitals;
              });
            }

            return vitals;
          })
        );

        return vitals;
      }),
    };
  });

  return Promise.all(tasks).then(function() {
    return meta;
  });
}

// clui driver for 'package.json"
if (process.argv.length > 2) {
  const inputPath = process.argv[2];
  fs.stat(inputPath, function(err, stats) {
    let infoFile = inputPath;
    if (stats.isDirectory()) {
      infoFile = `${path.join(inputPath, 'package.json')}`;
    }

    console.log(`reading ${infoFile}...`);
    fs.readFile(infoFile, null, function(err, data) {
      if (err) throw err;
      const json = JSON.parse(data);
      const deps = Object.keys(json).reduce(function(memo, key) {
        if (key.match(/.*dependenc.*/i)) {
          memo[key] = json[key];
        }

        return memo;
      }, {});

      fetchDependencyVitals(deps)
        .then(function(vitals) {
          vitals
            .concat()
            .sort(function(a, b) {
              return a.category.localeCompare(b.category);
            })
            .forEach(function(category) {
              console.log(`=== ${category.category}`);

              category.packages
                .concat()
                .sort(function(a, b) {
                  return a.name.localeCompare(b.name);
                })
                .forEach(function(pkg) {
                  console.log(`${pkg.package}@${pkg.version}`);
                  console.log(`${pkg.updated}`);

                  if ('github' in pkg) {
                    console.log(
                      `${pkg.github.repo}, ${pkg.github.stars} stars, ${
                        pkg.github.age
                      }`
                    );
                    console.log(`${pkg.github.updated}`);
                  }

                  console.log();
                });

              console.log();
            });
        })
        .catch(function(reason) {
          console.log(reason);
        });
    });
  });
} else {
  console.log('missing input');
}
