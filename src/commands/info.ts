import { Argv } from 'yargs'
import { logger } from '../logger'
import { blue, bold, gray, green, red, yellow, cyan } from 'picocolors'

interface InfoArgv {}

export const command = 'info'
export const describe = 'Basic command to display information about coding-cli.'
export const aliases = ['i']

export function builder(yargs: Argv<InfoArgv>): Argv {
  return yargs
}

export async function handler() {
  logger.log(
    `🎉 Welcome to ${yellow(bold('coding-cli'))} - the coding assistant that lives in your terminal and helps you make your projects better! ✨`,
  )
  logger.log('')
  logger.log(gray('─'.repeat(60)))
  logger.log(cyan(bold('🚀 Here are the commands you can use:')))
  logger.log('')
  logger.info(
    `${blue(bold('📚 explain'))} (x): Gives you in-depth explanations of a code file, tailored for the language you are using and for your level of expertise 🎯`,
  )
  logger.info(
    `${green(bold('✏️  edit'))} (e): Iterates in editing your code files by adding new features following your implementation ideas 💡`,
  )
  logger.info(
    `${red(bold('🔧 fix'))} (f): Iterates in fixing errors in your code files by following error traces and details provided by you! 🐛`,
  )
  logger.log('')
  logger.log(gray('─'.repeat(60)))
  logger.log(`💡 Run ${cyan(bold('coding-cli info'))} to print this information message again. 🔄`)
  logger.log('')
  logger.log(gray('Happy coding! 🎨👨‍💻👩‍💻'))
}
