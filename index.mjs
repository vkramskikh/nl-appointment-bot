import fs from 'fs';
import path from 'path';
import debug from 'debug';
import TelegramBot from 'node-telegram-bot-api';
import {Builder, By, until} from 'selenium-webdriver';
import {NoSuchElementError} from 'selenium-webdriver/lib/error.js';
import firefox from 'selenium-webdriver/firefox.js';

const appointmentPageUrl = 'https://www.vfsvisaonline.com/Netherlands-Global-Online-Appointment_Zone2/AppScheduling/AppWelcome.aspx?P=OG3X2CQ4L1NjVC94HrXIC7tGMHIlhh8IdveJteoOegY%3D';

const logError = debug('nl-appointment-bot:error');
const logInfo = debug('nl-appointment-bot:info');

process.on('unhandledRejection', (error) => logError('unhandled rejection', error));

const cwd = path.dirname(process.argv[1]);

const config = JSON.parse(fs.readFileSync(path.join(cwd, 'config.json'), {encoding: 'utf8'}));

const {
  token: TOKEN,
  chatId: CHAT_ID,
  checkInterval: CHECK_INTERVAL = 30 * 60 * 1000,
} = config;

const bot = new TelegramBot(TOKEN, {polling: true, filepath: false});
bot.on('polling_error', (error) => {
  logError('polling error', error);
  process.exit(-1);
});

bot.on('message', async (message) => {
  logInfo(message);
  return bot.sendMessage(message.chat.id, "This bot doesn't handle commands.");
});

const screen = {
  width: 1024,
  height: 768
};

async function checkForSlots() {
  const driver = await new Builder().forBrowser('firefox').setFirefoxOptions(new firefox.Options().headless().windowSize(screen)).build();
  try {
    await driver.get(appointmentPageUrl);
    await driver.findElement(By.id('plhMain_lnkSchApp')).click();

    const cityDropdown = driver.findElement(By.id('plhMain_cboVAC'));
    await driver.wait(until.elementIsEnabled(cityDropdown), 10000);
    const moscowOption = await cityDropdown.findElement(By.xpath('//option[contains(text(),"Moscow")]'));
    await moscowOption.click();
    await driver.findElement(By.id('plhMain_btnSubmit')).click();

    const visaCategoryDropdown = driver.findElement(By.id('plhMain_cboVisaCategory'));
    await driver.wait(until.elementIsEnabled(visaCategoryDropdown), 10000);
    const mvvOption = await visaCategoryDropdown.findElement(By.xpath('//option[contains(text(),"MVV")]'));
    await mvvOption.click();
    await driver.findElement(By.id('plhMain_btnSubmit')).click();

    const applicationDetailsHeader = driver.findElement(By.id('plhMain_lblAppDetails'));
    try {
      await driver.wait(until.elementIsVisible(applicationDetailsHeader), 10000);
    } catch (e) {
      if (e instanceof NoSuchElementError) {
        logInfo('No slots avaialble.');
        return;
      } else throw e;
    }
    logInfo('There are slots avaialble!');
    bot.sendMessage(CHAT_ID, 'Есть доступные слоты! ' + appointmentPageUrl);
  } catch (e) {
    logError(e);
  } finally {
    await driver.quit();
  }
}

setInterval(checkForSlots, CHECK_INTERVAL);
checkForSlots();
