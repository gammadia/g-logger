/*jslint node: true, white: true */
/**
 *	Module de log.
 *
 *	Encapsule Bunyan.
 */
module.exports = (function () {
	'use strict';

	var bunyan = require('bunyan'),			//	Bunyan -> https://github.com/trentm/node-bunyan
		parentLogger,						//	Instance parente du logger
		logger,								//	Logger spécifique au module de log
		cache = [],							//	Cache pour les demandes de log avant d'avoir
											//	initialisé le logger. (Démarrage de l'application)
		/**
		 *	Niveaux de log supportés:
		 *	- Fatal: L'application ne peut continuer et va s'arrêter.
		 *	- Error: La requête ne peut continuer, mais l'application tourne.
		 *	- Warn: Annormal, il faut vérifier ce qui s'est passé, les données peut-être erronées.
		 *	- Info: Opération normale, informations.
		 *	- Debug: Le reste, ce qui ne va pas dans info.
		 *	- Trace: Les sorties ou logs des lib externes.
		 */
		event_levels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'],

		/**
		 *	Fonction de log pour tous les niveaux.
		 *	Tant que le logger n'est pas configuré, stock les events dans le cache.
		 *	Une fois configuré, se reécrit pour appeler directement le logger et vide le cache.
		 */
		do_log = function (level, args) {
			/**
			 *	Le logger n'est pas défini, on entre les données dans le cache.
			 *	Elles serront logées plus tard.
			 */
			cache.push({
				level: level,
				args: args
			});

			if (parentLogger !== undefined && parentLogger[level] !== undefined) {
				/**
				 *	Si le logger est défini, on log les données du cache dans l'ordre.
				 */
				cache.forEach(function (item) {
					parentLogger[item.level].apply(parentLogger, item.args);
				});

				cache = [];

				/**
				 *	Puis on remplace la fonction par une version directe.
				 */
				do_log = function (level, args) {
					parentLogger[level].apply(parentLogger, args);
				};
			}
		},

		/**
		 *	Créer le logger selon la configuration donnée.
		 *
		 *	@param Object config Configuration du logger.
		 *	@returns this
		 */
		start = function (config) {
			parentLogger = bunyan.createLogger(config);
			logger = parentLogger.child({component: 'Logger'});
			logger.info('Logger "%s" démarré', config.name);
		},

		/**
		 *	Créé une instance enfant du logger avec des paramètres prédéfinits.
		 *	Exemple: log_child = log.child({composant: 'Mon composant'});
		 *
		 *	Applique un curry sur toutes les fonctions de log (niveaux) et les attribues au nouvel objet.
		 *
		 *	@param Object options Liste des options à merger avec le logger parent.
		 *	@returns Object Nouvel objet logger avec fonctions modifiées.
		 */
		child = function (options) {
			/**
			 *	Objet de base, child sert à créer des enfants d'enfants, avec héritage.
			 */
			var child_obj = {
				child: child
			};

			/**
			 *	Curry des fonctions de log de chaque niveaux.
			 *
			 *	Le paramètre options est fusionné avec les arguments de la fonction.
			 */
			event_levels.forEach(function (level) {
				child_obj[level] = function () {
					var extend = require('node.extend'),	//	Clone de jQuery.extend()
						args = Array.prototype.slice.call(arguments);	//	Conversion de arguments en Array.

					/**
					 *	Traite le premier argument seulement si c'est un objet.
					 *	Sinon c'est le message et on insère l'objet avant.
					 */
					if (typeof args[0] === 'object') {
						args[0] = extend(args[0], options);
					} else {
						args.unshift(options);
					}

					return do_log.apply(this, [level, args]);
				};
			});

			return child_obj;
		},

		/**
		 *	Exposition des fonctions publiques.
		 */
		pub = {
			start:	start,
			child:	child
		};

	/**
	 *	Exportation des fonctions de log pour chaque niveau.
	 */
	event_levels.forEach(function (level) {
		pub[level] = function () { return do_log(level, arguments); };
	});


	return pub;
}());
