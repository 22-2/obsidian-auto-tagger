import log from "loglevel";

export function toggleLoggerBy(
	level: log.LogLevelDesc,
	filter: (name: string) => boolean = () => true,
): void {
	Object.values(log.getLoggers())
		// @ts-expect-error
		.filter((logger) => filter(logger.name))
		.forEach((logger) => {
			logger.setLevel(level);
		});
	console.log("log level changed ->", level);
	log.setLevel(level);
}
