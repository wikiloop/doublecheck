<?php
/**
 * Minimal MediaWiki LocalSettings.php for local development.
 * Used by docker-compose.yml to configure the MediaWiki container.
 *
 * After first run, you may need to run the MediaWiki installer:
 *   docker compose exec mediawiki php maintenance/install.php \
 *     --dbserver mediawiki-db --dbname mediawiki \
 *     --dbuser mediawiki --dbpass mediawiki \
 *     --server "http://localhost:8080" --scriptpath "" \
 *     --lang en --pass admin-password "DoubleCheck Wiki" "Admin"
 */

# Basic site settings
$wgSitename = "DoubleCheck Dev Wiki";
$wgServer = "http://localhost:8080";
$wgScriptPath = "";
$wgArticlePath = "/wiki/$1";

# Database settings — connects to the mediawiki-db MariaDB container
$wgDBtype = "mysql";
$wgDBserver = "mediawiki-db";
$wgDBname = "mediawiki";
$wgDBuser = "mediawiki";
$wgDBpassword = "mediawiki";
$wgDBprefix = "";
$wgDBTableOptions = "ENGINE=InnoDB, DEFAULT CHARSET=binary";

# Secret keys — local dev only, not for production
$wgSecretKey = "doublecheck-local-dev-secret-key-not-for-production-use";
$wgUpgradeKey = "doublecheck-upgrade";

# Enable the API (required for DoubleCheck)
$wgEnableAPI = true;
$wgEnableWriteAPI = true;

# Allow anonymous editing for local testing
$wgGroupPermissions['*']['edit'] = true;

# Skin
$wgDefaultSkin = "vector-2022";
wfLoadSkin( 'Vector' );

# TODO: Enable OAuth extension for OAuth flow testing
# Requires the OAuth extension to be installed in the container.
# wfLoadExtension( 'OAuth' );
# $wgGroupPermissions['sysop']['mwoauthproposeconsumer'] = true;
# $wgGroupPermissions['sysop']['mwoauthmanageconsumer'] = true;
# $wgGroupPermissions['sysop']['mwoauthviewprivate'] = true;
# $wgGroupPermissions['sysop']['mwoauthupdateownconsumer'] = true;

# Debug settings for local development
$wgShowExceptionDetails = true;
$wgShowDBErrorBacktrace = true;
$wgShowSQLErrors = true;
