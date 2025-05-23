// This script adds a new "iNaturalist Import" button to taxon categories or gallery
// pages (whichever one is associated with the Wikidata item for the taxon).

// The code for this script is hosted on GitHub (https://github.com/kaldari/iNaturalist2Commons)
// and any issues may be reported there. It is dual licensed under the MIT License
// and the Creative Commons Attribution-ShareAlike License.

//<nowiki>

// Make sure we are on a Category page and in view mode.
if ( ( mw.config.get( 'wgNamespaceNumber' ) === 0 || mw.config.get( 'wgNamespaceNumber' ) === 14 ) && mw.config.get( 'wgAction' ) === 'view' ) {

	// Move this out when converting to gadget
	mw.loader.load( 'https://commons.wikimedia.org/w/index.php?title=User:Kaldari/inat2commons.css&action=raw&ctype=text/css', 'text/css' );

	// Initialize global iNaturalist ID variable
	iNatId = null;

	// Script depends on jQuery UI dialog and jQuery UI selectable modules
	mw.loader.using( ['mediawiki.user', 'mediawiki.api', 'mediawiki.ForeignApi', 'jquery.ui'], function() {
		// Construct object (to prevent namespace conflicts)
		inat2commons = {

			displayProgress: function( message ) {
				$( '#import-dialog div' ).remove(); // remove everything else from the dialog box
				$( '#import-dialog' ).append ( $( '<div class="import-progress" style="text-align:center;margin:1.8em 0;"></div>' ).html( message+'<br/><br/><img src="//upload.wikimedia.org/wikipedia/commons/4/42/Loading.gif" />' ) );
			},

			displayMessage: function( message ) {
				$( '#import-dialog div' ).remove(); // remove everything else from the dialog box
				$( '#import-dialog' ).append ( $( '<div class="import-message"></div>' ).html( message ) );
			},

			displayError: function( error ) {
				$( '#import-dialog div' ).remove(); // remove everything else from the dialog box
				$( '#import-dialog' ).append ( $( '<div class="import-error" style="color:#990000;"></div>' ).html( 'Error: '+error ) );
			},

			capitalizeFirstLetter: function( string ) {
				return string.charAt(0).toUpperCase() + string.slice(1);
			},

			launchPreview: function( uploadParams ) {
				var imageExtension = uploadParams.thumbUrl.split('.').pop();
				uploadParams.mediumUrl =  uploadParams.thumbUrl.replace('/square', '/medium');
				$previewInterface = $( '<div></div>', {
					id: "preview-dialog",
					style: "position: relative; text-align: center; min-height: 500px;",
					html: "<p><img src='" + uploadParams.mediumUrl + "' /><\p>"
				} )
				.dialog({
					width: 600,
					autoOpen: false,
					title: 'Preview',
					modal: false,
					position: { my: "top", at: "top+150", of: "body" },
					buttons: [
						{
							text: "Upload image",
							classes: "inaturalist-upload-button",
							click: function() {
								uploadParams.originalUrl =  uploadParams.thumbUrl.replace('/square', '/original');
								$previewInterface.dialog( 'close' );
								inat2commons.launchUpload( uploadParams );
							}
						}
					]
				});
				$previewInterface.dialog( 'open' );
			},

			launchUpload: function( uploadParams ) {
				var href = '';
				var uploadPage = 'https://commons.wikimedia.org/wiki/Special:Upload';
				var license = '';
				var description = '';
				var author = '';
				if ( uploadParams.taxonRank === 'species' || uploadParams.taxonRank === 'subspecies' ) {
					if ( uploadParams.commonName !== undefined ) {
						description = inat2commons.capitalizeFirstLetter( uploadParams.commonName ) + " (''" + uploadParams.taxon + "'')";
					} else {
						description = "''" + uploadParams.taxon + "''";
					}
				} else {
					description = uploadParams.taxon;
				}
				switch ( uploadParams.photoLicense ) {
					case 'cc-by':
						license = 'cc-by-4.0';
						break;
					case 'cc-by-sa':
						license = 'cc-by-sa-4.0';
						break;
					case 'cc0':
						license = 'Cc-zero';
						break;
					default:
						return '';
				}
				var ext = uploadParams.thumbUrl.split( '?' )[0].split('.').slice( -1 );
				var targetName = `${uploadParams.taxon} ${uploadParams.photoId}.jpg`;
				var original = uploadParams.originalUrl;
				if ( uploadParams.userName ) {
					author = uploadParams.userName;
				} else {
					author = uploadParams.userLogin;
				}
				var location = ( uploadParams.geojson !== undefined ) ? `
{{Location|${uploadParams.geojson.coordinates[1]}|${uploadParams.geojson.coordinates[0]}}}` : '';
				var placeList = uploadParams.places.toString();
				var iNatApi = 'https://api.inaturalist.org/v1/places/' + placeList;
				var params = { 'admin_level': '0' };
				$.getJSON( iNatApi, params )
					.always( function( data ) {
						if ( data.results[0] !== undefined && data.results[0].name !== undefined ) {
							var country = data.results[0].name;
							var theCountries = ["Bahamas", "Cayman Islands", "Central African Republic", "Channel Islands", "Comoros", "Czech Republic", "Dominican Republic", "Falkland Islands", "Gambia", "Isle of Man", "Ivory Coast", "Leeward Islands", "Maldives", "Marshall Islands", "Netherlands", "Netherlands Antilles", "Philippines", "Solomon Islands", "Turks and Caicos Islands", "United Arab Emirates", "United Kingdom", "United States", "Virgin Islands"];
							if ( theCountries.includes( country ) ) {
								country = "the " + country;
							}
							description += " in " + country;
						}
						var summary = `{{Information
|description={{en|${description}}}
|date=${uploadParams.date}
|source=https://www.inaturalist.org/photos/${uploadParams.photoId}
|author=[https://www.inaturalist.org/users/${uploadParams.userId} ${author}]
|permission=
|other versions=
}}${location}
{{iNaturalist|${uploadParams.observationId}}}
{{iNaturalistreview}}

[[Category:${uploadParams.category}]]
[[Category:Uploaded with iNaturalist2Commons]]
`;
						var href = `${uploadPage}?wpUploadDescription=${encodeURIComponent(summary)}&wpLicense=${license}&wpDestFile=${targetName}&wpSourceType=url&wpUploadFileURL=${original}`;
						window.open( href, "uploadWindow" );
				} );
			},

			launchDialog: function() {
				var iNatApi = 'https://api.inaturalist.org/v1/observations';
				var uri = new URL(window.location);
				var maxImages = 104;
				var params = { 'photo_license': 'cc0,cc-by,cc-by-sa', 'quality_grade': 'research', 'taxon_id': iNatId };

				// Allow overriding with an observation ID
				// For example '?inatid=73898408'
				if ( uri.searchParams.get('inatid') ) {
					params.id = uri.searchParams.get('inatid');
				}

				// Allow overriding quality grade with a query string parameter
				// For example '?inatquality=casual' or '?inatquality=needs_id'
				if ( uri.searchParams.get('inatquality') ) {
					params.quality_grade = uri.searchParams.get('inatquality');
				}

				// Allow overriding number of images with a query string parameter
				if ( uri.searchParams.get('inatquantity') ) {
					maxImages = parseInt( uri.searchParams.get('inatquantity') );
				}
				params.per_page = maxImages - 20; // Some observations have multiple images

				// Restore dialog to original state
				inat2commons.displayProgress( 'Loading images...');
				// Open the dialog box
				$importInterface.dialog( 'open' );
				// Retrieve images
				$.getJSON( iNatApi, params )
					.done( function( data ) {
						if ( data.results[0] === undefined ) {
							inat2commons.displayMessage( 'No free license images were found for this taxon.');
						} else {
							var headerAdded = false;
							var x = 0;
							// Go through each observation
							data.results.forEach( function( observation ) {
								// Go through each photo
								observation.photos.forEach( function( photoData ) {
									var licenseCode = photoData.license_code;
									// If the license is compatible, display the photo
									if ( ( licenseCode === 'cc-by' || licenseCode === 'cc-by-sa' || licenseCode === 'cc0' ) && x < maxImages ) {
										// Create dialog header once we know there is at least one free-license image
										if ( headerAdded === false ) {
											$( '#import-dialog div' ).remove();
											$( '#import-dialog' ).append( $( '<div id="import-images"></div>' ).html( 'Select an image to preview:<br/>' ).append ( $( '<ol></ol>' ) ) );
											headerAdded = true;
										}
										var uploadParams = {
											photoId: photoData.id,
											photoLicense: photoData.license_code,
											userId: observation.user.id,
											userName: observation.user.name,
											userLogin: observation.user.login,
											observationId: observation.id,
											date: observation.observed_on,
											taxon: observation.taxon.name,
											taxonRank: observation.taxon.rank,
											places: observation.place_ids,
											thumbUrl: photoData.url,
											category: mw.config.get( 'wgTitle' )
										};
										if ( !observation.geoprivacy ) {
											uploadParams.geojson = observation.geojson;
										}
										if ( observation.taxon.preferred_common_name !== undefined ) {
											uploadParams.commonName = observation.taxon.preferred_common_name;
										}
										$( '#import-dialog ol' ).append ( $( '<li></li>' )
											.html( '<img data-photo-id="' + photoData.id + '" src="' + photoData.url + '" height="75" width="75"/>' )
											.on( 'click', function() {
												inat2commons.launchPreview( uploadParams );
											} )
										);
										x++;
									}
								} );
							} );
							// After going through all the observations, if there are no free-license images, display error
							if ( headerAdded === false ) {
								inat2commons.displayMessage( 'No free license images were found for this taxon.');
							}
						}
					} )
					.fail( function() {
						inat2commons.displayError( 'Loading images failed. If you are using a privacy plug-in like Privacy Badger, you may need to adjust your settings.' );
					} );
			},

			tryFallbackQueries: function( params, wikidataApi ) {
				// Try getting the data associated with the main namespace page of the same title
				params.sites = 'commonswiki';
				params.titles = mw.config.get( 'wgTitle' );
				delete params.ids;
				// Make API call to Wikidata
				wikidataApi.get( params ).done( function ( data2 ) {
					// Get the Wikidata item ID
					wikidataId = Object.keys( data2.entities )[0];
					// Wikidata returns "-1" for undefined
					if ( wikidataId !== "-1" && data2.entities[wikidataId].claims.P3151 !== undefined && data2.entities[wikidataId].claims.P3151[0].mainsnak.datavalue.value !== undefined ) {
						// Get the iNaturalist ID (P3151)
						iNatId = data2.entities[wikidataId].claims.P3151[0].mainsnak.datavalue.value;
						// Insert import button into page interface
						$( '#firstHeading' ).append( $button );
					} else {
						// Last resort: Try getting the data associated with the English Wikipedia article
						params.sites = 'enwiki';
						wikidataApi.get( params ).done( function ( data3 ) {
							wikidataId = Object.keys( data3.entities )[0];
							if ( wikidataId !== "-1" && data3.entities[wikidataId].claims.P3151 !== undefined && data3.entities[wikidataId].claims.P3151[0].mainsnak.datavalue.value !== undefined ) {
								// Get the iNaturalist ID (P3151)
								iNatId = data3.entities[wikidataId].claims.P3151[0].mainsnak.datavalue.value;
								// Insert import button into page interface
								$( '#firstHeading' ).append( $button );
							}
						});
					}
				});
			},

			initialize: function() {
				// Define importing interface
				$importInterface = $('<div id="import-dialog" style="position:relative;"></div>')
					.dialog({
						width: 724,
						autoOpen: false,
						title: 'Import images from iNaturalist',
						modal: true,
						position: { my: "top", at: "top+100", of: "body" },
					});
				// Define the import button
				$button = $( '<button>' )
					.attr( 'style', 'margin: 0 0.5em 0.5em 0.5em; text-decoration: none; font-size: 15px;' )
					.append(
						$( '<span>' )
							.attr( 'id', 'inat2commons-buttontextwrapper' )
							.append( $( '<span>' )
								.attr( 'id', 'inat2commons-buttontext' )
								.text( 'iNaturalist import' ) )
					)
					.on( 'click', function () {
						inat2commons.launchDialog();
						return false;
					} )
					.button();

				// Check user rights and get the iNaturalist ID
				$( document ).ready( function() {
					var wikidataId = mw.config.get( 'wgWikibaseItemId' );
					var wikidataApi = new mw.ForeignApi('//www.wikidata.org/w/api.php');
					var params = { 'action': 'wbgetentities', 'props': 'claims' };

					mw.user.getRights().then( function ( rights ) {
						// Make sure the user has the 'upload_by_url' right
						if ( rights.indexOf( 'upload_by_url' ) > -1 ) {
							// Try getting the iNaturalist ID from the Wikidata infobox
							var wdinfobox = document.getElementById( 'wdinfobox' );
							if ( wdinfobox ) {
								var matches = wdinfobox.innerHTML.match(/https:\/\/www\.inaturalist\.org\/taxa\/(\d+)/);
								if ( matches ) {
									iNatId = matches[1];
									// Insert import button into page interface
									$( '#firstHeading' ).append( $button );
								}
							}
							if ( !iNatId ) {
								// If the Category page has an associated Wikidata ID, try that first
								if ( wikidataId ) {
									params.ids = wikidataId;
									// Make API call to Wikidata
									wikidataApi.get( params ).done( function ( data ) {
										if ( data.entities[wikidataId].claims.P3151 !== undefined && data.entities[wikidataId].claims.P3151[0].mainsnak.datavalue.value !== undefined ) {
											// Get the iNaturalist ID (P3151)
											iNatId = data.entities[wikidataId].claims.P3151[0].mainsnak.datavalue.value;
											// Insert import button into page interface
											$( '#firstHeading' ).append( $button );
										} else {
											inat2commons.tryFallbackQueries( params, wikidataApi );
										}
									});
								} else {
									inat2commons.tryFallbackQueries( params, wikidataApi );
								}
							}
						}
					} );
				});

			} // close initialize function

		} // close inat2commons object
		inat2commons.initialize();
	}) // close mw.loader
} // close if
//</nowiki>
