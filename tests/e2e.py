#!/usr/bin/env python3
"""Browser test: opens index.html in headless Chromium, runs both directions on
the FAKE sample files and checks the downloaded workbooks.
Usage: python3 tests/e2e.py   (needs: pip install playwright openpyxl && playwright install chromium)
"""
import asyncio
from pathlib import Path
import openpyxl
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent.parent
S = ROOT / "tests" / "samples"
OUT = ROOT / "tests" / "out"


async def main():
    OUT.mkdir(exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(accept_downloads=True)
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        await page.goto((ROOT / "index.html").as_uri())

        # 1) roster -> ImportCandidate
        await page.set_input_files("#r-file", str(S / "roster_sample.xlsx"))
        await page.wait_for_selector("#r-result.show")
        async with page.expect_download() as d:
            await page.click("#r-dl")
        await (await d.value).save_as(OUT / "importcandidate.xlsx")
        ws = openpyxl.load_workbook(OUT / "importcandidate.xlsx").active
        assert ws["B9"].value == "احمد" and str(ws["F9"].value) == "30801011400011", "ImportCandidate row 9"
        assert ws.max_row - 8 == 9, "ImportCandidate student count"

        # 2) E-Testing -> grade sheet
        await page.goto((ROOT / "index.html").as_uri() + "#grades")
        await page.set_input_files("#g-etest", str(S / "etest_sample.xlsx"))
        await page.set_input_files("#g-sheet", str(S / "grade_sheet_sample.xlsx"))
        await page.wait_for_selector("#g-result.show")
        async with page.expect_download() as d:
            await page.click("#g-dl")
        await (await d.value).save_as(OUT / "grades.xlsx")
        ws = openpyxl.load_workbook(OUT / "grades.xlsx").active
        got = [ws.cell(r, 5).value for r in range(4, 13)]
        assert got == ["15", "12", "18", "9", " ", "17", "11", "14", " "], got

        assert not errors, errors
        await browser.close()
    print("e2e ok: both directions produced the expected files")


asyncio.run(main())
