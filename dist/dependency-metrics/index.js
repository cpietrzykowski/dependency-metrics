'use strict';var _fs=require('fs');var _fs2=_interopRequireDefault(_fs);var _path=require('path');var _path2=_interopRequireDefault(_path);var _npmRegistryClient=require('npm-registry-client');var _npmRegistryClient2=_interopRequireDefault(_npmRegistryClient);var _moment=require('moment');var _moment2=_interopRequireDefault(_moment);var _dotenv=require('dotenv');var _dotenv2=_interopRequireDefault(_dotenv);var _rest=require('@octokit/rest');var _rest2=_interopRequireDefault(_rest);function _interopRequireDefault(obj){return obj&&obj.__esModule?obj:{default:obj}}_dotenv2.default.config();function createNpmRegistryApiClient(){const config={};const client=new _npmRegistryClient2.default(config);const baseuri='https://registry.npmjs.org/';const params={'timeout':1000};return function(name){const pkg=name.replace(/@(.*)/,function(_,$1){return`@${encodeURIComponent($1)}`});return new Promise(function(resolve,reject){client.get(`${baseuri}${pkg}`,params,function(err,data,raw,res){if(err)return reject(err);return resolve(data)})})}}const npmRegistryClient=createNpmRegistryApiClient();function fetchNpmPackageVitals(pkg,version){return npmRegistryClient(pkg).then(function(data){const name=data['name'];const latest=data['dist-tags']['latest'];const latestReleaseDate=(0,_moment2.default)(data['time'][latest]);const latestRepoUrl=data['versions'][latest]['repository']['url'];return{name,'latest':{'version':latest,'release':latestReleaseDate,'repo':latestRepoUrl}}})}function createGithubApiClient(accessToken){const client=(0,_rest2.default)();if(accessToken){client.authenticate({'type':'token','token':accessToken})}return client}const githubApiClient=createGithubApiClient(process.env.GITHUB_ACCESSTOKEN);function fetchGithubRepositoryVitals(owner,repo){return githubApiClient.repos.get({owner,repo}).then(function(response){const{data}=response;const createdAt=(0,_moment2.default)(data['created_at']);const updatedAt=(0,_moment2.default)(data['updated_at']);return{'name':data.full_name,'created':createdAt,'updated':updatedAt,'stars':data['stargazers_count']}})}function fetchDependencyVitals(dependencies){const tasks=[];const npmmemo={};const ghmemo={};const meta=Object.keys(dependencies).map(function(category){return{category,'packages':Object.keys(dependencies[category]).map(function(pkg){const vitals={'package':pkg};const version=dependencies[category][pkg];tasks.push(new Promise(function(resolve,reject){if(pkg in npmmemo){return resolve(npmmemo[pkg])}return fetchNpmPackageVitals(pkg,version).then(function(meta){npmmemo[pkg]=meta;return resolve(meta)})}).then(function(npmmeta){vitals['name']=npmmeta['name'];vitals['version']=`${npmmeta['latest']['version']} (${version})`;const npmrelease=npmmeta['latest']['release'];vitals['updated']=`Updated: ${npmrelease.fromNow()} (${npmrelease})`;const repo=npmmeta['latest']['repo'];const matches=repo.match(/.*github.com\/(.*)\.git/);if(matches){return new Promise(function(resolve,reject){const repoid=matches[1];if(repoid in ghmemo){return resolve(ghmemo[repoid])}const[owner,repo]=repoid.split('/');return fetchGithubRepositoryVitals(owner,repo).then(function(meta){ghmemo[repoid]=meta;return resolve(meta)})}).then(function(meta){vitals['github']={repo,'name':meta['name'],'stars':meta['stars'],'age':`${meta['created'].from(meta['updated'],true)}`,'updated':`Updated: ${meta['updated'].fromNow()} (${meta['updated']})`};return vitals})}return vitals}));return vitals})}});return Promise.all(tasks).then(function(){return meta})}if(process.argv.length>2){const inputPath=process.argv[2];_fs2.default.stat(inputPath,function(err,stats){let infoFile=inputPath;if(stats.isDirectory()){infoFile=`${_path2.default.join(inputPath,'package.json')}`}console.log(`reading ${infoFile}...`);_fs2.default.readFile(infoFile,null,function(err,data){if(err)throw err;const json=JSON.parse(data);const deps=Object.keys(json).reduce(function(memo,key){if(key.match(/.*dependenc.*/i)){memo[key]=json[key]}return memo},{});fetchDependencyVitals(deps).then(function(vitals){vitals.concat().sort(function(a,b){return a.category.localeCompare(b.category)}).forEach(function(category){console.log(`=== ${category.category}`);category.packages.concat().sort(function(a,b){return a.name.localeCompare(b.name)}).forEach(function(pkg){console.log(`${pkg.package}@${pkg.version}`);console.log(`${pkg.updated}`);if('github'in pkg){console.log(`${pkg.github.repo}, ${pkg.github.stars} stars, ${pkg.github.age}`);console.log(`${pkg.github.updated}`)}console.log()});console.log()})}).catch(function(reason){console.log(reason)})})})}else{console.log('missing input')}
//# sourceMappingURL=index.js.map