import fs from 'fs';
import path from 'path';
import debug from 'debug';
import TelegramBot from 'node-telegram-bot-api';
import {Builder, By, until} from 'selenium-webdriver';
import {NoSuchElementError} from 'selenium-webdriver/lib/error.js';
import firefox from 'selenium-webdriver/firefox.js';

const appointmentPageUrl = 'https://www.vfsvisaonline.com/Netherlands-Global-Online-Appointment_Zone2/AppScheduling/AppWelcome.aspx?P=OG3X2CQ4L1NjVC94HrXIC7tGMHIlhh8IdveJteoOegY%3D';
const city = 'Moscow';

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

async function checkForSlots() {
  const driver = await new Builder()
    .forBrowser('firefox')
    .setFirefoxOptions(
      new firefox.Options()
      .headless()
      .windowSize({width: 1024, height: 768}))
    .build();
  try {
    await driver.get(appointmentPageUrl);
    await driver.findElement(By.id('plhMain_lnkSchApp')).click();

    const cityDropdown = driver.findElement(By.id('plhMain_cboVAC'));
    await driver.wait(until.elementIsEnabled(cityDropdown), 10000);
    const cityOption = await cityDropdown.findElement(By.xpath('//option[contains(text(),"' + city + '")]'));
    await cityOption.click();
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

    let screenshot = null;
    try {
      await driver.findElement(By.xpath('//select[@id="plhMain_repAppVisaDetails_cboTitle_0"]/option[contains(text(),"MR")]')).click();
      await driver.findElement(By.id('plhMain_repAppVisaDetails_tbxFName_0'))
        .sendKeys(Math.random().toString(36).replace(/[^a-z]+/g, '').toUpperCase());
      await driver.findElement(By.id('plhMain_repAppVisaDetails_tbxLName_0'))
        .sendKeys(Math.random().toString(36).replace(/[^a-z]+/g, '').toUpperCase());
      await driver.findElement(By.id('plhMain_repAppVisaDetails_tbxContactNumber_0'))
        .sendKeys('927' + Math.random().toString().substr(-7));
      await driver.findElement(By.id('plhMain_repAppVisaDetails_tbxEmailAddress_0'))
        .sendKeys(Math.random().toString(36).replace(/[^a-z]+/g, '') + '@gmail.com');
      await driver.findElement(By.xpath('//select[@id="plhMain_cboConfirmation"]/option[contains(text(),"confirm")]')).click();
      await driver.findElement(By.id('plhMain_btnSubmit')).click();

      const calendar = driver.findElement(By.id('plhMain_cldAppointment'));
      await driver.wait(until.elementIsVisible(calendar), 10000);
      screenshot = await calendar.takeScreenshot();
    } catch (e) {
      logError('Failed to take calendar screenshot.');
      logError(e);
    }

    logInfo('There are slots avaialble!');
    const successMessage = '[Есть доступные слоты!](' + appointmentPageUrl + ')';
    if (screenshot) {
      await bot.sendPhoto(CHAT_ID, Buffer.from(screenshot, 'base64'), {caption: successMessage, parse_mode: 'Markdown'});
    } else {
      await bot.sendMessage(CHAT_ID, successMessage, {parse_mode: 'Markdown'});
    }
  } catch (e) {
    logError(e);
  } finally {
    await driver.quit();
  }
}

setInterval(checkForSlots, CHECK_INTERVAL);
checkForSlots();
