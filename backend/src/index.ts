'use strict';

import { Logger } from 'sitka';
import Express from 'express';
import { Hop } from '@hop-protocol/sdk';

const logger: Logger = Logger.getLogger('index');

const app = Express();
const port = 4000;

app.get('/', (req, res) => {
	res.send('Hello World!');

	const hop = new Hop('mainnet', undefined, undefined);
	logger.info('Hop', hop);
});

app.listen(port, () => {
	logger.info(`Example app listening on port ${port}`);
});
