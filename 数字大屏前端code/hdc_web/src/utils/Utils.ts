import {
	Message
} from 'element-ui'

export default class Utils {
	static showMessage(msg, level) {
		Message({
			message: msg,
			type: level
		});
	}


}